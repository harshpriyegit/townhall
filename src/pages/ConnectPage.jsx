import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { datingAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import '../styles/connect.css';

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : window.location.origin;

function resolveUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

// Generate Fibonacci points on a sphere
function getSpherePoints(count) {
  const points = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2; // y goes from 1 to -1 (top to bottom)
    const radius = Math.sqrt(1 - y * y); // radius at y
    const theta = phi * i; // Golden angle rotation
    const x = Math.cos(theta) * radius;
    const z = Math.sin(theta) * radius;
    points.push({ x, y, z });
  }
  return points;
}

// Rotate point (x,y,z) by pitch and yaw in degrees
function rotatePoint(point, pitch, yaw) {
  const pitchRad = (pitch * Math.PI) / 180;
  const yawRad = (yaw * Math.PI) / 180;
  const { x, y, z } = point;

  // 1. Rotate around Y axis (yaw)
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  const x1 = x * cosY + z * sinY;
  const y1 = y;
  const z1 = -x * sinY + z * cosY;

  // 2. Rotate around X axis (pitch)
  const cosX = Math.cos(pitchRad);
  const sinX = Math.sin(pitchRad);
  const xRot = x1;
  const yRot = y1 * cosX - z1 * sinX;
  const zRot = y1 * sinX + z1 * cosX;

  return { xRot, yRot, zRot };
}

// Vertex Shader Source
const VS_SOURCE = `
  attribute vec2 position;
  varying vec2 vTexCoord;
  void main() {
    vTexCoord = position * 0.5 + 0.5;
    vTexCoord.y = 1.0 - vTexCoord.y; // Flip Y coordinate
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

// Fragment Shader Source (Procedural Ray-Casted Sphere with Tangent Space Normal Mapping)
const FS_SOURCE = `
  precision highp float;
  varying vec2 vTexCoord;
  uniform sampler2D uTexture;
  uniform sampler2D uNormalMap;
  uniform vec2 uRotation; // yaw (x), pitch (y) in radians
  uniform vec3 uLightDir;
  uniform float uBumpScale;

  void main() {
    vec2 p = vTexCoord * 2.0 - 1.0;
    float r2 = dot(p, p);
    if (r2 > 1.0) {
      discard; // Out of spherical boundary
    }
    
    float z = sqrt(1.0 - r2);
    vec3 normal = vec3(p.x, p.y, z); // spherical normals in view space
    
    // Rotations (inverse rotation to map view space normal back to local sphere coordinates)
    float yaw = uRotation.x;
    float pitch = uRotation.y;
    
    // 1. Rotate around X axis (pitch) by -pitch
    float cosP = cos(pitch);
    float sinP = sin(pitch);
    vec3 n1 = vec3(
      normal.x,
      normal.y * cosP + normal.z * sinP,
      -normal.y * sinP + normal.z * cosP
    );
    
    // 2. Rotate around Y axis (yaw) by -yaw
    float cosY = cos(yaw);
    float sinY = sin(yaw);
    vec3 rotatedNormal = vec3(
      n1.x * cosY - n1.z * sinY,
      n1.y,
      n1.x * sinY + n1.z * cosY
    );
    
    // Map normal coordinates to spherical UVs
    float pi = 3.14159265359;
    float u = atan(rotatedNormal.x, rotatedNormal.z) / (2.0 * pi) + 0.5;
    float v = asin(rotatedNormal.y) / pi + 0.5;
    
    // Sample normal map texture and unpack from [0, 1] to [-1, 1]
    vec3 normalTex = texture2D(uNormalMap, vec2(u, v)).rgb * 2.0 - 1.0;
    
    // Compute spherical tangents for perturbed normal orientation
    vec3 tangent = vec3(normal.z, 0.0, -normal.x);
    if (length(tangent) > 0.0001) {
      tangent = normalize(tangent);
    }
    vec3 bitangent = cross(normal, tangent);
    
    // Apply normal mapping in view space
    vec3 perturbedNormal = normalize(
      tangent * normalTex.x * uBumpScale + 
      bitangent * normalTex.y * uBumpScale + 
      normal * normalTex.z
    );
    
    // Shading calculations (diffuse + ambient light base)
    // Ambient minimum is 0.01 for sharp vacuum deep space shadows
    float diffuse = max(0.01, dot(perturbedNormal, uLightDir));
    
    // Sample texture map
    vec4 texColor = texture2D(uTexture, vec2(u, v));
    
    // Realistic moon albedo tuning (desaturated, warm grey, high contrast)
    vec3 col = texColor.rgb;
    col = col * vec3(1.0, 0.98, 0.95); // subtle warm grey tint
    col = pow(col, vec3(1.15)) * 1.1; // contrast and brightness boost
    
    // Combine diffuse color and light levels (no shiny specular highlight for realistic matte regolith)
    vec3 finalColor = col * diffuse;
    
    // No atmospheric/rim glow to keep the moon edge sharp against the vacuum of space
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Helper to normalize light vector
function vec3Normalize(v) {
  const len = Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
  if (len > 0.00001) {
    return [v[0]/len, v[1]/len, v[2]/len];
  }
  return [0, 0, 1];
}

// Custom WebGL Canvas Component to render the 3D Moon with Bump Mapping
function MoonCanvas({ yaw, pitch }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const textureRef = useRef(null);
  const normalMapRef = useRef(null);
  const imageLoadedRef = useRef(false);

  const draw = () => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program || !imageLoadedRef.current) return;

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0); // Transparent base
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(program);

    // Bind diffuse texture to Texture Unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
    const uTexture = gl.getUniformLocation(program, 'uTexture');
    gl.uniform1i(uTexture, 0);

    // Bind normal map texture to Texture Unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, normalMapRef.current);
    const uNormalMap = gl.getUniformLocation(program, 'uNormalMap');
    gl.uniform1i(uNormalMap, 1);

    // Pass yaw & pitch rotation coordinates in radians
    const uRotation = gl.getUniformLocation(program, 'uRotation');
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    gl.uniform2f(uRotation, yawRad, pitchRad);

    // Directional light source from top-left (matches moon visual specifications)
    const uLightDir = gl.getUniformLocation(program, 'uLightDir');
    const light = vec3Normalize([-0.5, 0.5, 0.72]);
    gl.uniform3f(uLightDir, light[0], light[1], light[2]);

    // Bump scale map height details strength
    const uBumpScale = gl.getUniformLocation(program, 'uBumpScale');
    gl.uniform1f(uBumpScale, 1.2); 

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      console.error('WebGL not supported by browser.');
      return;
    }
    glRef.current = gl;

    // Compile Shader helper
    const compileShader = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compiler error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }
    programRef.current = program;

    // Full screen rendering quad coordinates
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    // Initialize Diffuse Texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    textureRef.current = texture;

    // Initialize Normal Map Texture
    const normalMap = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, normalMap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    normalMapRef.current = normalMap;

    let loadedCount = 0;
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === 2) {
        imageLoadedRef.current = true;
        draw();
      }
    };

    // Load full moon diffuse map
    const img = new Image();
    img.src = '/moon_map.png';
    img.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, textureRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      checkAllLoaded();
    };

    // Load pre-generated normal map
    const normalImg = new Image();
    normalImg.src = '/moon_normal.png';
    normalImg.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, normalMapRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, normalImg);
      checkAllLoaded();
    };

    return () => {
      gl.deleteTexture(texture);
      gl.deleteTexture(normalMap);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    draw();
  }, [yaw, pitch]);

  return (
    <canvas 
      ref={canvasRef} 
      width={320} 
      height={320}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        display: 'block',
        pointerEvents: 'none' // Clicks slide through to parent wrapper for drag controls
      }}
    />
  );
}

const MOCK_PROFILES_EXTENDED = [
  // Batch 1 (16 profiles)
  { id: 'mock-1', name: 'Priya', age: 20, branch: 'CSE', bio: 'Coffee addict ☕ | Love hiking and coding marathons', interests: ['Music', 'Travel', 'Coding', 'Coffee'], initials: 'PR', online: true },
  { id: 'mock-2', name: 'Arjun', age: 21, branch: 'ECE', bio: 'Music is my therapy 🎸 | Sports enthusiast', interests: ['Music', 'Sports', 'Gaming', 'Travel'], initials: 'AR', online: false },
  { id: 'mock-3', name: 'Sneha', age: 19, branch: 'IT', bio: 'Bookworm 📖 | Aspiring data scientist', interests: ['Books', 'Data Science', 'Art', 'Cooking'], initials: 'SN', online: true },
  { id: 'mock-4', name: 'Rahul', age: 22, branch: 'MECH', bio: 'Car enthusiast 🚗 | Gym rat', interests: ['Cars', 'Fitness', 'Photography', 'Tech'], initials: 'RA', online: true },
  { id: 'mock-5', name: 'Ananya', age: 20, branch: 'BioTech', bio: 'Dance 💃 | Foodie | Always exploring', interests: ['Dance', 'Food', 'Travel', 'Movies'], initials: 'AN', online: false },
  { id: 'mock-6', name: 'Ishaan', age: 21, branch: 'Civil', bio: 'Always seeking adrenaline adventures 🏂', interests: ['Outdoors', 'Sports', 'Travel'], initials: 'IS', online: true },
  { id: 'mock-7', name: 'Kavya', age: 20, branch: 'Chem', bio: 'Film photography lover 📷 and record collector', interests: ['Art', 'Music', 'Photography'], initials: 'KV', online: false },
  { id: 'mock-8', name: 'Kabir', age: 22, branch: 'CSE', bio: 'Cybersecurity researcher and CTF player 💻', interests: ['Coding', 'Tech', 'Cybersecurity'], initials: 'KB', online: true },
  { id: 'mock-9', name: 'Riya', age: 19, branch: 'Design', bio: 'Illustrator and UI/UX designer. Pixel perfect always!', interests: ['Art', 'Design', 'Anime'], initials: 'RY', online: true },
  { id: 'mock-10', name: 'Dev', age: 21, branch: 'IT', bio: 'Full stack developer. Building the future one semi-colon at a time.', interests: ['Coding', 'Tech', 'SaaS'], initials: 'DV', online: false },
  { id: 'mock-11', name: 'Tara', age: 20, branch: 'EEE', bio: 'Guitar player and indie rock fan 🎸 Let\'s swap playlists.', interests: ['Music', 'Concerts', 'Indie'], initials: 'TR', online: true },
  { id: 'mock-12', name: 'Neil', age: 21, branch: 'MECH', bio: 'Aviation geek and amateur drone pilot 🛩️', interests: ['Drones', 'Physics', 'Outdoors'], initials: 'NL', online: false },
  { id: 'mock-13', name: 'Diya', age: 20, branch: 'CSE', bio: 'Baking is my jam 🍰 Love to read thriller novels.', interests: ['Baking', 'Books', 'Movies'], initials: 'DY', online: true },
  { id: 'mock-14', name: 'Yash', age: 22, branch: 'ECE', bio: 'Basketball player 🏀 and fitness coach.', interests: ['Sports', 'Fitness', 'Nutrition'], initials: 'YS', online: true },
  { id: 'mock-15', name: 'Meera', age: 19, branch: 'BioTech', bio: 'Nature lover 🌿. Let\'s plant more trees and save the planet.', interests: ['Gardening', 'Travel', 'Volunteering'], initials: 'MR', online: false },
  { id: 'mock-16', name: 'Aarav', age: 21, branch: 'Civil', bio: 'Exploring historic architecture and sketching on weekends.', interests: ['Art', 'History', 'Sketching'], initials: 'AA', online: true },

  // Batch 2 (16 profiles)
  { id: 'mock-17', name: 'Aditi', age: 20, branch: 'CSE', bio: 'Dance is my expression 💃. Kathak dancer and foodie.', interests: ['Dance', 'Food', 'Culture'], initials: 'AD', online: true },
  { id: 'mock-18', name: 'Rohan', age: 21, branch: 'MECH', bio: 'Motorsports enthusiast 🏎️. Formula 1 fanatic.', interests: ['Racing', 'Tech', 'F1'], initials: 'RH', online: false },
  { id: 'mock-19', name: 'Neha', age: 19, branch: 'IT', bio: 'Love solving sudoku and Rubik\'s cubes 🧩.', interests: ['Puzzles', 'Math', 'Gaming'], initials: 'NH', online: true },
  { id: 'mock-20', name: 'Siddharth', age: 22, branch: 'ECE', bio: 'Vocalist in a local college band 🎤. Let\'s jam.', interests: ['Music', 'Singing', 'Guitar'], initials: 'SD', online: true },
  { id: 'mock-21', name: 'Kriti', age: 20, branch: 'Design', bio: 'Fashion designer in the making 👗. Love sketching.', interests: ['Fashion', 'Sketching', 'Art'], initials: 'KR', online: false },
  { id: 'mock-22', name: 'Sameer', age: 21, branch: 'Civil', bio: 'Avid trekker ⛰️. Weekend adventurer.', interests: ['Hiking', 'Mountains', 'Nature'], initials: 'SM', online: true },
  { id: 'mock-23', name: 'Pooja', age: 20, branch: 'Chem', bio: 'Chemistry lab assistant by day, blogger by night 🧪.', interests: ['Writing', 'Science', 'Blogs'], initials: 'PJ', online: false },
  { id: 'mock-24', name: 'Vikram', age: 22, branch: 'CSE', bio: 'Open source contributor. Linus Torvalds fanboy 🐧.', interests: ['Linux', 'Git', 'Coding'], initials: 'VK', online: true },
  { id: 'mock-25', name: 'Shreya', age: 19, branch: 'IT', bio: 'Loves classical music and playing the violin 🎻.', interests: ['Music', 'Violin', 'Reading'], initials: 'SH', online: true },
  { id: 'mock-26', name: 'Pranav', age: 21, branch: 'MECH', bio: 'Robotics team lead. Building bots that run the world 🤖.', interests: ['Robotics', 'Tech', 'Coding'], initials: 'PN', online: false },
  { id: 'mock-27', name: 'Avani', age: 20, branch: 'EEE', bio: 'A clean energy advocate. Solar and wind tech enthusiast 🔋.', interests: ['GreenTech', 'Physics', 'Innovation'], initials: 'AV', online: true },
  { id: 'mock-28', name: 'Abhishek', age: 21, branch: 'ECE', bio: 'Dating app reviewer? Just kidding. Looking for a tech buddy.', interests: ['Tech', 'Social', 'Coffee'], initials: 'AB', online: false },
  { id: 'mock-29', name: 'Tanya', age: 20, branch: 'BioTech', bio: 'Microbiology is fascinating 🦠. Pet parent to two dogs.', interests: ['Pets', 'Dogs', 'Science'], initials: 'TN', online: true },
  { id: 'mock-30', name: 'Manish', age: 22, branch: 'Civil', bio: 'Table tennis champion 🏓. Let\'s play a match.', interests: ['Sports', 'Table Tennis', 'Fitness'], initials: 'MN', online: true },
  { id: 'mock-31', name: 'Heena', age: 19, branch: 'Design', bio: 'Graphic designer. Creating vector arts and badges 🎨.', interests: ['Design', 'Art', 'Illustrator'], initials: 'HN', online: false },
  { id: 'mock-32', name: 'Gaurav', age: 21, branch: 'IT', bio: 'Coffee explorer ☕. Let\'s try the new campus cafe.', interests: ['Coffee', 'Cafe', 'Music'], initials: 'GR', online: true },

  // Batch 3 (16 profiles)
  { id: 'mock-33', name: 'Janhvi', age: 20, branch: 'CSE', bio: 'Competitive coder 💻. Love solving logic puzzles.', interests: ['Coding', 'Algorithms', 'Logic'], initials: 'JH', online: true },
  { id: 'mock-34', name: 'Karan', age: 21, branch: 'MECH', bio: 'Automotive engineer. Design fast cars is my dream 🏎️.', interests: ['Cars', 'CAD', 'Design'], initials: 'KN', online: false },
  { id: 'mock-35', name: 'Lisa', age: 19, branch: 'IT', bio: 'K-pop fan 🎵. Fluent in Korean and love makeup art.', interests: ['K-pop', 'Korea', 'Makeup'], initials: 'LS', online: true },
  { id: 'mock-36', name: 'Madhav', age: 22, branch: 'ECE', bio: 'Ham radio operator 📻 and electronics tinkerer.', interests: ['Radio', 'Hardware', 'DIY'], initials: 'MD', online: true },
  { id: 'mock-37', name: 'Nikita', age: 20, branch: 'BioTech', bio: 'DNA sequencing expert. Love gardening and indoor plants 🌿.', interests: ['Plants', 'Science', 'Nature'], initials: 'NK', online: false },
  { id: 'mock-38', name: 'Omkar', age: 21, branch: 'Civil', bio: 'Guitarist and lyricist. Creating acoustic songs.', interests: ['Music', 'Guitar', 'Songwriting'], initials: 'OK', online: true },
  { id: 'mock-39', name: 'Prisha', age: 20, branch: 'Chem', bio: 'Perfume developer. Finding the best fragrance combinations.', interests: ['Fragrances', 'Science', 'Fashion'], initials: 'PS', online: false },
  { id: 'mock-40', name: 'Rishabh', age: 22, branch: 'CSE', bio: 'Game developer. Working with Unity and Unreal Engine 🎮.', interests: ['Gaming', 'Unity', '3D Coding'], initials: 'RB', online: true },
  { id: 'mock-41', name: 'Sakshi', age: 19, branch: 'Design', bio: 'Calligraphy artist. Writing quotes in style ✒️.', interests: ['Art', 'Writing', 'Calligraphy'], initials: 'SK', online: true },
  { id: 'mock-42', name: 'Tushar', age: 21, branch: 'IT', bio: 'Blogger and freelance tech writer. Always online.', interests: ['Writing', 'Tech', 'Blogs'], initials: 'TS', online: false },
  { id: 'mock-43', name: 'Urvi', age: 20, branch: 'EEE', bio: 'IoT builder. Automating my home with Arduino.', interests: ['Arduino', 'IoT', 'Hardware'], initials: 'UV', online: true },
  { id: 'mock-44', name: 'Varun', age: 21, branch: 'MECH', bio: 'Gym trainer on part-time. Always tracking macros 💪.', interests: ['Fitness', 'Gym', 'Nutrition'], initials: 'VR', online: false },
  { id: 'mock-45', name: 'Wamiqa', age: 20, branch: 'CSE', bio: 'Manga collector 📚 and anime lover. Otaku at heart.', interests: ['Manga', 'Anime', 'Japanese'], initials: 'WQ', online: true },
  { id: 'mock-46', name: 'Xavier', age: 22, branch: 'ECE', bio: 'Street photographer. Capturing raw emotions 📷.', interests: ['Photography', 'Travel', 'Art'], initials: 'XV', online: true },
  { id: 'mock-47', name: 'Yamini', age: 19, branch: 'Civil', bio: 'Yoga practitioner 🧘. Seeking mindfulness and peace.', interests: ['Yoga', 'Meditation', 'Health'], initials: 'YM', online: false },
  { id: 'mock-48', name: 'Zian', age: 21, branch: 'IT', bio: 'Crypto miner and blockchain investor. Web3 enthusiast.', interests: ['Crypto', 'Blockchain', 'Web3'], initials: 'ZN', online: true }
];

const MATCHES = [
  { id: 'm-1', name: 'Isha', initials: 'IS' },
  { id: 'm-2', name: 'Dev', initials: 'DV' },
  { id: 'm-3', name: 'Riya', initials: 'RI' },
];

export default function ConnectPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [discoverProfiles, setDiscoverProfiles] = useState([]);
  const [connections, setConnections] = useState([]);

  // Rotation parameters
  const [pitch, setPitch] = useState(0); 
  const [yaw, setYaw] = useState(0); 
  const [fadeOpacity, setFadeOpacity] = useState(1);
  const [batchIndex, setBatchIndex] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [connectionSuccess, setConnectionSuccess] = useState(null); // null | { isMatch: boolean }
  const [submittingConnect, setSubmittingConnect] = useState(false);

  // Drag listeners refs
  const isDragging = useRef(false);
  const previousPos = useRef({ x: 0, y: 0 });
  const accumulatedYaw = useRef(0);
  const apiDiscoverList = useRef([]);

  // Preferences configuration state
  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem('townhall_connect_preferences');
      return stored ? JSON.parse(stored) : {
        ageMin: 18,
        ageMax: 25,
        distance: 100,
        gender: 'All',
        interests: [],
        discovery: true
      };
    } catch {
      return {
        ageMin: 18,
        ageMax: 25,
        distance: 100,
        gender: 'All',
        interests: [],
        discovery: true
      };
    }
  });

  // Modal preferences fields
  const [isEditing, setIsEditing] = useState(false);
  const [formAgeMin, setFormAgeMin] = useState(preferences.ageMin);
  const [formAgeMax, setFormAgeMax] = useState(preferences.ageMax);
  const [formDistance, setFormDistance] = useState(preferences.distance);
  const [formGender, setFormGender] = useState(preferences.gender);
  const [formInterests, setFormInterests] = useState(preferences.interests?.join(', ') || '');
  const [formDiscovery, setFormDiscovery] = useState(preferences.discovery);

  // Profile Form state (for connect profile)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [formAge, setFormAge] = useState('');
  const [formBranch, setFormBranch] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formProfileInterests, setFormProfileInterests] = useState('');
  const [formLookingFor, setFormLookingFor] = useState('');

  // Fibonacci sphere points (16 points on a sphere)
  const spherePoints = useMemo(() => getSpherePoints(16), []);

  const applyFiltering = (prefs) => {
    let list = [...apiDiscoverList.current];
    if (list.length === 0) {
      list = [...MOCK_PROFILES_EXTENDED];
    }

    // Filter by age range
    list = list.filter(p => p.age >= prefs.ageMin && p.age <= prefs.ageMax);

    // Filter by interests (if preferences have interests)
    if (prefs.interests && prefs.interests.length > 0) {
      list = list.filter(p => 
        p.interests && p.interests.some(interest => 
          prefs.interests.some(prefInterest => 
            interest.toLowerCase().includes(prefInterest.toLowerCase())
          )
        )
      );
    }

    // Fallback if no matching profiles
    if (list.length === 0) {
      list = MOCK_PROFILES_EXTENDED.slice(0, 16);
    }

    // Pad to multiple of 16 so the pagination has clean batches of 16
    const paddingNeeded = 16 - (list.length % 16);
    if (paddingNeeded > 0 && paddingNeeded < 16) {
      for (let i = 0; i < paddingNeeded; i++) {
        list.push(MOCK_PROFILES_EXTENDED[i % MOCK_PROFILES_EXTENDED.length]);
      }
    }

    setDiscoverProfiles(list);
    setBatchIndex(0);
  };

  const fetchDiscovery = async () => {
    try {
      const data = await datingAPI.discover();
      if (data.profiles && data.profiles.length > 0) {
        const mapped = data.profiles.map(p => ({
          id: p.id,
          userId: p.userId,
          name: p.user?.fullName || 'User',
          age: p.age || 20,
          branch: p.branch || 'VIT',
          bio: p.bio || '',
          interests: p.interests || [],
          initials: getInitials(p.user?.fullName),
          avatar: p.user?.avatar || null,
          online: Math.random() > 0.4
        }));
        apiDiscoverList.current = mapped;
      } else {
        apiDiscoverList.current = MOCK_PROFILES_EXTENDED;
      }
    } catch (err) {
      console.warn('Failed to fetch discover profiles, using local mock:', err.message);
      apiDiscoverList.current = MOCK_PROFILES_EXTENDED;
    }
    applyFiltering(preferences);
  };

  const fetchConnections = async () => {
    try {
      const data = await datingAPI.getMatches();
      if (data.matches && data.matches.length > 0) {
        const mapped = data.matches.map(m => ({
          id: m.id,
          name: m.fullName || 'User',
          initials: getInitials(m.fullName),
          avatar: m.avatar || null
        }));
        setConnections(mapped);
      } else {
        setConnections(MATCHES);
      }
    } catch (err) {
      console.warn('Failed to fetch matches, using local mock:', err.message);
      setConnections(MATCHES);
    }
  };

  // Check profile status on mount
  useEffect(() => {
    let cancelled = false;

    async function checkDatingProfile() {
      try {
        const data = await datingAPI.getProfile();
        if (cancelled) return;

        if (data.profile) {
          setProfileData(data.profile);
          setHasProfile(true);
          
          setFormAge(data.profile.age || '');
          setFormBranch(data.profile.branch || '');
          setFormBio(data.profile.bio || '');
          setFormProfileInterests(data.profile.interests?.join(', ') || '');
          setFormLookingFor(data.profile.lookingFor || '');
        } else {
          setHasProfile(false);
        }
      } catch (err) {
        console.warn('Failed to check dating profile status:', err.message);
        setHasProfile(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkDatingProfile();
    return () => { cancelled = true; };
  }, []);

  // Fetch lists after loading finishes
  useEffect(() => {
    if (!loading) {
      fetchDiscovery();
      fetchConnections();
    }
  }, [loading]);

  // Handle Drag/Touch rotation math
  const handleDragStart = (x, y) => {
    isDragging.current = true;
    previousPos.current = { x, y };
  };

  const handleDragMove = (x, y) => {
    if (!isDragging.current) return;
    const dx = x - previousPos.current.x;
    const dy = y - previousPos.current.y;
    
    // Sensitivity adjustments
    const sensitivity = 0.35;
    
    setYaw(prev => {
      const nextYaw = prev + dx * sensitivity;
      accumulatedYaw.current += Math.abs(dx * sensitivity);
      return nextYaw;
    });

    setPitch(prev => {
      const nextPitch = prev - dy * sensitivity;
      // Clamp pitch between -60 and 60 degrees to prevent gimbal flipping
      return Math.max(-60, Math.min(60, nextPitch));
    });

    previousPos.current = { x, y };

    // Batch loading trigger: Swap profiles upon 360° of accumulated horizontal rotation
    if (accumulatedYaw.current >= 360) {
      accumulatedYaw.current = 0;
      triggerBatchSwap();
    }
  };

  const handleDragEnd = () => {
    isDragging.current = false;
  };

  const triggerBatchSwap = () => {
    setFadeOpacity(0);
    setTimeout(() => {
      setBatchIndex(prev => {
        const next = prev + 16;
        return next >= discoverProfiles.length ? 0 : next;
      });
      setFadeOpacity(1);
    }, 300);
  };

  // Drag listeners bound to global window events for better drag capture
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging.current) {
        handleDragMove(e.clientX, e.clientY);
      }
    };
    const handleMouseUp = () => {
      handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [discoverProfiles.length]);

  // Action to connect with selected user
  const handleConnectRequest = async () => {
    if (!selectedUser || submittingConnect) return;
    setSubmittingConnect(true);
    try {
      const isMock = selectedUser.id.startsWith('mock-');
      if (isMock) {
        setTimeout(() => {
          const randMatch = Math.random() > 0.4; // 60% chance to match
          setConnectionSuccess({ isMatch: randMatch });
          setSubmittingConnect(false);
          if (randMatch) {
            setConnections(prev => [
              {
                id: selectedUser.id,
                name: selectedUser.name,
                initials: selectedUser.initials,
                avatar: selectedUser.avatar
              },
              ...prev
            ]);
          }
        }, 1000);
      } else {
        const result = await datingAPI.swipe(selectedUser.userId || selectedUser.id, 'like');
        setConnectionSuccess({ isMatch: result.isMatch });
        setSubmittingConnect(false);
        if (result.isMatch) {
          fetchConnections();
        }
      }
    } catch (err) {
      console.error('Failed to send connect swipe:', err);
      setSubmittingConnect(false);
    }
  };

  // Save Connect Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const interestsArray = formProfileInterests
        .split(',')
        .map(i => i.trim())
        .filter(Boolean);

      const result = await datingAPI.updateProfile({
        age: parseInt(formAge) || null,
        branch: formBranch,
        bio: formBio,
        interests: interestsArray,
        lookingFor: formLookingFor
      });

      const updated = result.profile || result;
      setProfileData(updated);
      setHasProfile(true);
      setIsEditingProfile(false);
      
      fetchDiscovery();
    } catch (err) {
      console.error('Failed to save connect profile:', err);
    }
  };

  // Save Connect Settings / Preferences Filter
  const handleSavePreferences = (e) => {
    e.preventDefault();
    const newPrefs = {
      ageMin: parseInt(formAgeMin),
      ageMax: parseInt(formAgeMax),
      distance: parseInt(formDistance),
      gender: formGender,
      interests: formInterests.split(',').map(i => i.trim()).filter(Boolean),
      discovery: formDiscovery
    };
    setPreferences(newPrefs);
    localStorage.setItem('townhall_connect_preferences', JSON.stringify(newPrefs));
    setIsEditing(false);
    applyFiltering(newPrefs);
  };

  // Get current batch of 16 profiles
  const currentBatch = useMemo(() => {
    return discoverProfiles.slice(batchIndex, batchIndex + 16);
  }, [discoverProfiles, batchIndex]);

  return (
    <div className="connect-page">
      {/* ── Immersive space background (Parallax & Drifts) ───── */}
      <div className="connect-space-container">
        <div className="connect-nebula nebula-violet" />
        <div className="connect-nebula nebula-teal" />
        <div className="connect-nebula nebula-indigo" />
        <div className="space-sun-glow" />
        <div className="starfield starfield-slow stars-distant" />
        <div className="starfield starfield-slow stars-medium" />
        <div className="starfield starfield-slow stars-near" />
        <div className="space-dust dust-pos-1" />
        <div className="space-dust dust-pos-2" />
        <div className="space-dust dust-pos-3" />
      </div>

      <div className="connect-container">
        
        {/* ── Header ────────────────────────────────────────── */}
        <header className="connect-header">
          <h1>🌐 Connect</h1>
          <p>Rotate the digital moon to discover and connect with VIT students</p>
        </header>

        {/* ── Top Bar ───────────────────────────────────────── */}
        {hasProfile && (
          <div className="connect-top-bar">
            <button className="setup-connect-btn" onClick={() => setIsEditing(true)}>
              ⚙️ Set Up Connect
            </button>
          </div>
        )}

        <div className="connect-layout">
          
          {/* ── Moon Discovery viewport ───────────────────────── */}
          <main className="connect-globe-area">
            {!hasProfile ? (
              <div className="connect-profile-prompt">
                <div className="connect-prompt-icon">🌙</div>
                <h3>Connect is locked</h3>
                <p>Set up your domain details to unlock the moon globe and discover other students!</p>
                <button className="connect-setup-action-btn" onClick={() => setIsEditingProfile(true)}>
                  Set Up Connect Profile
                </button>
              </div>
            ) : (
              <div className="connect-viewport">
                
                {/* Drag rotating sphere wrapper */}
                <div 
                  className="moon-globe-wrapper"
                  onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                  onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
                  onTouchEnd={handleDragEnd}
                >
                  {/* High-fidelity WebGL 3D Moon Sphere with dynamic Bump Map lighting */}
                  <MoonCanvas yaw={yaw} pitch={pitch} />

                  {/* Positioning layer for overlay nodes */}
                  <div className="moon-nodes-container">
                    {currentBatch.map((profile, idx) => {
                      const point = spherePoints[idx % 16];
                      if (!point) return null;

                      // Calculate rotated spherical coordinates
                      const { xRot, yRot, zRot } = rotatePoint(point, pitch, yaw);

                      // Hide if on the back hemisphere (depth zRot <= 0)
                      if (zRot <= 0) return null;

                      // Perspective calculations
                      const horizonOpacity = Math.max(0, Math.min(1, zRot * 2.5));
                      const displayOpacity = horizonOpacity * fadeOpacity;
                      const scale = 0.82 + zRot * 0.22;
                      const leftPercent = 50 + xRot * 50;
                      const topPercent = 50 + yRot * 50;

                      const nodeStyle = {
                        left: `calc(${leftPercent}% - 22px)`,
                        top: `calc(${topPercent}% - 22px)`,
                        transform: `scale(${scale})`,
                        opacity: displayOpacity,
                        zIndex: Math.round(10 + zRot * 15),
                        pointerEvents: zRot > 0.15 ? 'auto' : 'none'
                      };

                      return (
                        <div
                          key={profile.id + '-' + idx}
                          className={`globe-profile-node ${selectedUser?.id === profile.id ? 'active' : ''}`}
                          style={nodeStyle}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedUser(profile);
                            setConnectionSuccess(null);
                          }}
                        >
                          <div className="node-avatar">
                            {profile.avatar ? (
                              <img src={resolveUrl(profile.avatar)} alt="" />
                            ) : (
                              profile.initials
                            )}
                          </div>
                          {profile.online && <span className="node-status-dot" />}
                          <span className="node-tooltip">{profile.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="globe-swipe-hint">
                  <span className="swipe-arrow">←</span> Drag moon to rotate <span className="swipe-arrow">→</span>
                </div>

                {/* Profile detail card popup */}
                {selectedUser && (
                  <div className="connect-user-popup animate-popup">
                    <div className="popup-header">
                      <div className="popup-avatar">
                        {selectedUser.avatar ? (
                          <img src={resolveUrl(selectedUser.avatar)} alt="" />
                        ) : (
                          selectedUser.initials
                        )}
                      </div>
                      <div className="popup-meta">
                        <h4>{selectedUser.name}, {selectedUser.age}</h4>
                        <span>{selectedUser.branch}</span>
                      </div>
                      <button className="popup-close" onClick={() => setSelectedUser(null)}>✕</button>
                    </div>

                    <p className="popup-bio">{selectedUser.bio || 'No bio provided.'}</p>
                    
                    <div className="popup-tags">
                      {selectedUser.interests?.map(i => (
                        <span key={i} className="popup-tag">{i}</span>
                      ))}
                    </div>

                    <div className="popup-connect-action">
                      {connectionSuccess === null ? (
                        <button
                          className="popup-connect-btn"
                          onClick={handleConnectRequest}
                          disabled={submittingConnect}
                        >
                          {submittingConnect ? 'Connecting...' : '🤝 Connect'}
                        </button>
                      ) : connectionSuccess.isMatch ? (
                        <div className="connect-alert match">
                          <span>🎉 Connected! You matched with {selectedUser.name}!</span>
                          <button
                            className="connect-chat-btn"
                            onClick={() => navigate('/app/messages')}
                          >
                            💬 Chat Now
                          </button>
                        </div>
                      ) : (
                        <div className="connect-alert pending">
                          <span>📡 Connection request sent! They will see it in notifications.</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>

          {/* ── Sidebar ───────────────────────────────────────── */}
          <aside className="connect-sidebar">
            <div className="connect-sidebar-card">
              <h3 className="sidebar-card-title">Your Connections</h3>
              <p className="sidebar-card-subtitle">{connections.length} active connections</p>
              
              <div className="sidebar-connections-scroll">
                {connections.length === 0 ? (
                  <div className="sidebar-empty">No connections yet</div>
                ) : (
                  connections.map((c, i) => (
                    <div
                      key={i}
                      className="sidebar-connection-item"
                      onClick={() => navigate('/app/messages')}
                      title={`Chat with ${c.name}`}
                    >
                      <div className="connection-avatar">
                        {c.avatar ? (
                          <img src={resolveUrl(c.avatar)} alt="" />
                        ) : (
                          c.initials
                        )}
                      </div>
                      <span className="connection-name">{c.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="connect-sidebar-card">
              <h3 className="sidebar-card-title">Your Connect Profile</h3>
              {hasProfile ? (
                <div className="sidebar-profile-details">
                  <div className="profile-detail-row">
                    <span>Age</span>
                    <span>{profileData?.age}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span>Branch</span>
                    <span>{profileData?.branch}</span>
                  </div>
                  <div className="profile-detail-row">
                    <span>Looking For</span>
                    <span>{profileData?.lookingFor || 'Not specified'}</span>
                  </div>
                  <div className="profile-bio-section">
                    <span>BIO</span>
                    <p>{profileData?.bio}</p>
                  </div>
                  <div className="profile-interests-section">
                    <span>INTERESTS</span>
                    <div className="popup-tags">
                      {profileData?.interests?.map(i => (
                        <span key={i} className="popup-tag">{i}</span>
                      ))}
                    </div>
                  </div>
                  <button className="sidebar-edit-profile-btn" onClick={() => setIsEditingProfile(true)}>
                    ✍️ Edit Profile
                  </button>
                </div>
              ) : (
                <div className="sidebar-profile-empty">
                  <p>Configure your profile details to show on the globe!</p>
                  <button className="sidebar-edit-profile-btn" onClick={() => setIsEditingProfile(true)}>
                    🌐 Setup Profile
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Setup Preferences Modal ─────────────────────────── */}
      {isEditing && (
        <div className="connect-modal-backdrop">
          <div className="connect-modal">
            <div className="connect-modal-header">
              <h2>Set Up Connect</h2>
              <button className="connect-modal-close" onClick={() => setIsEditing(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePreferences} className="connect-modal-form">
              <div className="connect-form-group">
                <label>Preferred Age Range</label>
                <div className="connect-form-row">
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a6a6b8' }}>Min Age</label>
                    <input
                      type="number"
                      min="18"
                      max="35"
                      value={formAgeMin}
                      onChange={(e) => setFormAgeMin(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: '#a6a6b8' }}>Max Age</label>
                    <input
                      type="number"
                      min="18"
                      max="35"
                      value={formAgeMax}
                      onChange={(e) => setFormAgeMax(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="connect-form-group">
                <label>Preferred Distance (Radius)</label>
                <input
                  type="range"
                  min="5"
                  max="250"
                  step="5"
                  value={formDistance}
                  onChange={(e) => setFormDistance(e.target.value)}
                />
                <div className="range-slider-display">
                  <span>5m</span>
                  <span><strong>{formDistance} meters</strong></span>
                  <span>250m</span>
                </div>
              </div>

              <div className="connect-form-group">
                <label>Preferred Gender</label>
                <select value={formGender} onChange={(e) => setFormGender(e.target.value)}>
                  <option value="All">All Genders</option>
                  <option value="Female">Female only</option>
                  <option value="Male">Male only</option>
                  <option value="Other">Non-binary / Other</option>
                </select>
              </div>

              <div className="connect-form-group">
                <label>Filter Interests (comma separated)</label>
                <input
                  type="text"
                  value={formInterests}
                  onChange={(e) => setFormInterests(e.target.value)}
                  placeholder="e.g. Coding, Music, Travel"
                />
              </div>

              <div className="connect-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="pref-discovery"
                  checked={formDiscovery}
                  onChange={(e) => setFormDiscovery(e.target.checked)}
                  style={{ width: 'auto', transform: 'scale(1.2)' }}
                />
                <label htmlFor="pref-discovery" style={{ textTransform: 'none', cursor: 'pointer', margin: 0 }}>
                  Enable discovery features
                </label>
              </div>

              <div className="connect-modal-actions">
                <button type="button" className="connect-btn-cancel" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
                <button type="submit" className="connect-btn-submit">
                  Save Preferences
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Setup/Edit Profile Modal ────────────────────────── */}
      {isEditingProfile && (
        <div className="connect-modal-backdrop">
          <div className="connect-modal">
            <div className="connect-modal-header">
              <h2>{hasProfile ? 'Edit Connect Profile' : 'Set Up Connect Profile'}</h2>
              <button className="connect-modal-close" onClick={() => setIsEditingProfile(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile} className="connect-modal-form">
              <div className="connect-form-group">
                <label>Age</label>
                <input
                  type="number"
                  min="16"
                  max="35"
                  required
                  value={formAge}
                  onChange={(e) => setFormAge(e.target.value)}
                  placeholder="e.g. 20"
                />
              </div>

              <div className="connect-form-group">
                <label>Branch / Major</label>
                <input
                  type="text"
                  required
                  value={formBranch}
                  onChange={(e) => setFormBranch(e.target.value)}
                  placeholder="e.g. CSE"
                />
              </div>

              <div className="connect-form-group">
                <label>Bio</label>
                <textarea
                  required
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Introduce yourself..."
                  maxLength="250"
                  rows="3"
                />
              </div>

              <div className="connect-form-group">
                <label>Interests (comma separated)</label>
                <input
                  type="text"
                  value={formProfileInterests}
                  onChange={(e) => setFormProfileInterests(e.target.value)}
                  placeholder="e.g. Music, Coding, Sports"
                />
              </div>

              <div className="connect-form-group">
                <label>What are you looking for?</label>
                <input
                  type="text"
                  value={formLookingFor}
                  onChange={(e) => setFormLookingFor(e.target.value)}
                  placeholder="e.g. Friends, Study partner"
                />
              </div>

              <div className="connect-modal-actions">
                <button type="button" className="connect-btn-cancel" onClick={() => setIsEditingProfile(false)}>
                  Cancel
                </button>
                <button type="submit" className="connect-btn-submit">
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
