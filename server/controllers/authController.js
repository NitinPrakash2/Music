const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sql } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'relaxify_secret_key';

const signup = async (req, res) => {
  const { name, email, password } = req.body;
  if (!name?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`;
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const [user] = await sql`
      INSERT INTO users (name, email, password)
      VALUES (${name.trim()}, ${email.toLowerCase()}, ${hash})
      RETURNING id, name, email, created_at
    `;
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('[SIGNUP ERROR]', err.message);
    res.status(500).json({ error: 'Signup failed' });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email?.trim() || !password)
    return res.status(400).json({ error: 'Email and password are required' });
  try {
    const [user] = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase()}`;
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error('[LOGIN ERROR]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
};

const me = async (req, res) => {
  try {
    const auth = req.headers.authorization?.split(' ')[1];
    if (!auth) return res.status(401).json({ error: 'No token' });
    const decoded = jwt.verify(auth, JWT_SECRET);
    const [user] = await sql`SELECT id, name, email, created_at FROM users WHERE id = ${decoded.id}`;
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const updateAccount = async (req, res) => {
  const { name, currentPassword, newPassword } = req.body;
  if (!currentPassword) return res.status(400).json({ error: 'Current password is required' });
  try {
    const [user] = await sql`SELECT * FROM users WHERE id = ${req.user.id}`;
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const updatedName = name?.trim() || user.name;
    const updatedPassword = newPassword ? await bcrypt.hash(newPassword, 10) : user.password;
    const [updated] = await sql`UPDATE users SET name = ${updatedName}, password = ${updatedPassword} WHERE id = ${req.user.id} RETURNING id, name, email`;
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    await sql`DELETE FROM users WHERE id = ${req.user.id}`;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { signup, login, me, updateAccount, deleteAccount };
