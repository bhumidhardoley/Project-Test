const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/volunteerdb';
mongoose.connect(MONGO_URI).then(() => console.log('MongoDB connected')).catch(console.error);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  signedUpOpportunities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity' }],
  createdAt: { type: Date, default: Date.now }
});

const opportunitySchema = new mongoose.Schema({
  title: { type: String, required: true },
  organization: { type: String, required: true },
  description: { type: String, required: true },
  category: {
    type: String,
    enum: ['Education', 'Environment', 'Health', 'Animals', 'Elderly', 'Food', 'Arts', 'Community'],
    required: true
  },
  date: { type: Date, required: true },
  endDate: { type: Date },
  location: {
    city: { type: String, required: true },
    state: { type: String, required: true },
    address: { type: String },
    coordinates: { lat: Number, lng: Number }
  },
  spotsTotal: { type: Number, default: 20 },
  spotsRemaining: { type: Number, default: 20 },
  volunteers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  imageUrl: { type: String, default: '' },
  contactEmail: { type: String },
  skills: [String],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Opportunity = mongoose.model('Opportunity', opportunitySchema);

const JWT_SECRET = process.env.JWT_SECRET || 'volunteer_secret_key_2024';

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate('signedUpOpportunities');
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/opportunities', async (req, res) => {
  try {
    const { category, city, dateFrom, dateTo, search, page = 1, limit = 12 } = req.query;
    const filter = {};
    if (category && category !== 'All') filter.category = category;
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (dateFrom || dateTo) {
      filter.date = {};
      if (dateFrom) filter.date.$gte = new Date(dateFrom);
      if (dateTo) filter.date.$lte = new Date(dateTo);
    }
    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { organization: new RegExp(search, 'i') }
      ];
    }
    const total = await Opportunity.countDocuments(filter);
    const opportunities = await Opportunity.find(filter)
      .sort({ date: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ opportunities, total, pages: Math.ceil(total / limit), page: Number(page) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/opportunities/:id', async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id).populate('volunteers', 'name');
    if (!opp) return res.status(404).json({ error: 'Not found' });
    res.json(opp);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/opportunities', authenticate, async (req, res) => {
  try {
    const opp = await Opportunity.create({ ...req.body, spotsRemaining: req.body.spotsTotal || 20 });
    res.status(201).json(opp);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/opportunities/:id/signup', authenticate, async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
    if (opp.spotsRemaining <= 0) return res.status(400).json({ error: 'No spots remaining' });
    if (opp.volunteers.includes(req.user.id)) return res.status(400).json({ error: 'Already signed up' });
    opp.volunteers.push(req.user.id);
    opp.spotsRemaining -= 1;
    await opp.save();
    await User.findByIdAndUpdate(req.user.id, { $addToSet: { signedUpOpportunities: opp._id } });
    res.json({ message: 'Successfully signed up!', spotsRemaining: opp.spotsRemaining });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/opportunities/:id/signup', authenticate, async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ error: 'Not found' });
    opp.volunteers = opp.volunteers.filter(v => v.toString() !== req.user.id);
    opp.spotsRemaining = Math.min(opp.spotsRemaining + 1, opp.spotsTotal);
    await opp.save();
    await User.findByIdAndUpdate(req.user.id, { $pull: { signedUpOpportunities: opp._id } });
    res.json({ message: 'Successfully withdrawn' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/seed', async (req, res) => {
  try {
    await Opportunity.deleteMany({});
    const seeds = [
      { title: 'Beach Cleanup Drive', organization: 'Ocean Guardians', description: 'Join us to clean up Santa Monica Beach and protect marine life. Gloves and bags provided.', category: 'Environment', date: new Date('2025-04-15'), location: { city: 'Santa Monica', state: 'CA', address: '1 Ocean Ave' }, spotsTotal: 50, spotsRemaining: 32, skills: ['Physical fitness'], contactEmail: 'info@oceanguardians.org' },
      { title: 'After-School Tutoring', organization: 'BrightMinds Foundation', description: 'Help elementary students with reading and math. Training provided for volunteers.', category: 'Education', date: new Date('2025-04-10'), location: { city: 'Los Angeles', state: 'CA', address: '456 Hope St' }, spotsTotal: 15, spotsRemaining: 7, skills: ['Patience', 'Teaching'], contactEmail: 'tutors@brightminds.org' },
      { title: 'Animal Shelter Helper', organization: 'Pawsome Rescue', description: 'Walk dogs, socialize cats, and assist staff at our busy rescue shelter.', category: 'Animals', date: new Date('2025-04-20'), location: { city: 'San Diego', state: 'CA', address: '789 Paws Lane' }, spotsTotal: 20, spotsRemaining: 14, skills: ['Love for animals'], contactEmail: 'volunteer@pawsome.org' },
      { title: 'Community Garden Build', organization: 'Green Thumbs LA', description: 'Help construct raised garden beds in underserved neighborhoods to improve food access.', category: 'Food', date: new Date('2025-05-01'), location: { city: 'Los Angeles', state: 'CA', address: '321 Garden Blvd' }, spotsTotal: 30, spotsRemaining: 18, skills: ['Gardening', 'Construction'], contactEmail: 'build@greenthumbsla.org' },
      { title: 'Senior Tech Support', organization: 'Silver Connect', description: 'Teach seniors how to use smartphones and video calls to stay connected with family.', category: 'Elderly', date: new Date('2025-04-25'), location: { city: 'Pasadena', state: 'CA', address: '555 Silver Ave' }, spotsTotal: 10, spotsRemaining: 4, skills: ['Technology', 'Communication'], contactEmail: 'help@silverconnect.org' },
      { title: 'Free Health Clinic Support', organization: 'HealthBridge', description: 'Assist medical staff at our monthly free clinic serving uninsured residents.', category: 'Health', date: new Date('2025-05-10'), location: { city: 'Long Beach', state: 'CA', address: '100 Medical Dr' }, spotsTotal: 25, spotsRemaining: 11, skills: ['Medical background preferred'], contactEmail: 'clinic@healthbridge.org' },
      { title: 'Mural Painting Project', organization: 'City Arts Collective', description: "Help paint a large community mural celebrating the neighborhood's history and culture.", category: 'Arts', date: new Date('2025-05-15'), location: { city: 'Los Angeles', state: 'CA', address: '200 Art District' }, spotsTotal: 35, spotsRemaining: 22, skills: ['Painting', 'Creativity'], contactEmail: 'art@cityartscollective.org' },
      { title: 'Food Bank Sorting', organization: 'FeedLA', description: 'Sort and package donated food items for distribution to families in need across Los Angeles.', category: 'Food', date: new Date('2025-04-18'), location: { city: 'Los Angeles', state: 'CA', address: '987 Hunger St' }, spotsTotal: 40, spotsRemaining: 28, skills: ['Organization'], contactEmail: 'sort@feedla.org' },
    ];
    await Opportunity.insertMany(seeds);
    res.json({ message: `Seeded ${seeds.length} opportunities` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));