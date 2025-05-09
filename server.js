const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-secret-key'; // Keep this secret in production

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from "public" and "uploads"
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage });

// Helper functions
const readUsers = () => JSON.parse(fs.readFileSync('users.json', 'utf8') || '[]');
const writeUsers = (data) => fs.writeFileSync('users.json', JSON.stringify(data, null, 2));
const readPosts = () => JSON.parse(fs.readFileSync('posts.json', 'utf8') || '[]');
const writePosts = (data) => fs.writeFileSync('posts.json', JSON.stringify(data, null, 2));

// Auth middleware
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Routes
app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;
  const users = readUsers();

  if (users.find(u => u.email === email)) {
    return res.status(400).json({ message: 'Email already exists' });
  }

  const newUser = {
    id: users.length + 1,
    username,
    email,
    password,
    profilePicture: '',
    bio: '',
    followers: 0,
    following: 0,
    postsCount: 0
  };

  users.push(newUser);
  writeUsers(users);
  res.status(201).json({ message: 'User created' });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY);
  res.json({ token, user });
});

// Places endpoint
app.get('/places', (req, res) => {
  const { state } = req.query;
  
  // Dummy data for all states
  const statePlaces = {
    'Karnataka': [
      { name: 'Mysore Palace', kinds: 'historic_architecture,palace', dist: 500 },
      { name: 'Hampi', kinds: 'historic_ruins,unesco', dist: 1200 }
    ],
    'Tamil Nadu': [
      { name: 'Meenakshi Temple', kinds: 'religious_temple', dist: 300 }
    ],
    'Goa': [
      { name: 'Baga Beach', kinds: 'beach,nature', dist: 200 }
    ],
    'Maharashtra': [
      { name: 'Gateway of India', kinds: 'monument,historic', dist: 100 }
    ],
    'Rajasthan': [
      { name: 'Hawa Mahal', kinds: 'palace,architecture', dist: 300 }
    ],
    'Kerala': [
      { name: 'Backwaters', kinds: 'nature,water', dist: 50 }
    ],
    'Uttar Pradesh': [
      { name: 'Taj Mahal', kinds: 'monument,unesco', dist: 200 }
    ],
    'default': []
  };

  res.json(statePlaces[state] || statePlaces.default);
});

// Upload post
app.post('/posts', authenticate, upload.single('image'), (req, res) => {
  const { placeName, country, city, travelDate, description, rating, tags } = req.body;
  if (!req.file) return res.status(400).json({ message: 'Image is required' });

  const posts = readPosts();
  const users = readUsers();

  const newPost = {
    id: posts.length + 1,
    userId: req.user.id,
    imageUrl: `/uploads/${req.file.filename}`,
    placeName,
    country,
    city,
    travelDate,
    description,
    rating: parseFloat(rating),
    tags: tags?.split(',') || [],
    createdAt: new Date().toISOString()
  };
  posts.push(newPost);

  const user = users.find(u => u.id === req.user.id);
  user.postsCount = posts.filter(p => p.userId === user.id).length;
  writeUsers(users);
  writePosts(posts);

  res.status(201).json({ success: true, message: 'Post created', post: newPost });
});

// Get posts for authenticated user
app.get('/posts', authenticate, (req, res) => {
  const posts = readPosts();
  const userPosts = posts.filter(p => p.userId === req.user.id);
  res.json({ success: true, posts: userPosts });
});

// Delete post
app.delete('/posts/:id', authenticate, (req, res) => {
  const postId = parseInt(req.params.id);
  const posts = readPosts();
  const users = readUsers();

  const index = posts.findIndex(p => p.id === postId && p.userId === req.user.id);
  if (index === -1) return res.status(404).json({ message: 'Post not found' });

  const [deleted] = posts.splice(index, 1);
  const filePath = path.join(__dirname, 'uploads', path.basename(deleted.imageUrl));
  fs.unlink(filePath, err => { if (err && err.code !== 'ENOENT') console.error(err); });

  const user = users.find(u => u.id === req.user.id);
  user.postsCount = posts.filter(p => p.userId === user.id).length;
  writeUsers(users);
  writePosts(posts);

  res.json({ success: true, message: 'Post deleted' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
});