require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { 
  User, Project, StudentGroup, ClassroomGroup, Assignment, Submission, 
  Chat, Quiz, TestAssignment, QuizResult, TestViolation, MarkEntry, ProjectIdea, Timetable, Report, Metric 
} = require('./models');
const { encrypt, decrypt } = require('./encryption');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/unimanage';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

app.use(cors());
app.use(bodyParser.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again later.' }
});

const createToken = (user) =>
  jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/auth/register') {
    return next();
  }
  return authenticateToken(req, res, next);
});

// Updated connection (no deprecated options)
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB Connected');

    // Create Developer Account if not exists
    const devExists = await User.findOne({ role: 'DEVELOPER' });
    if (!devExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('dev123', salt);
      const hashedSecondPassword = await bcrypt.hash('secure456', salt); // 2nd Step Password

      await new User({
        id: 'dev_master',
        username: 'developer',
        password: hashedPassword,
        secondPassword: hashedSecondPassword,
        role: 'DEVELOPER',
        fullName: 'System Developer',
        department: 'IT'
      }).save();

      console.log('Developer account created: developer / dev123 / secure456');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Middleware to track activity and API metrics
const trackActivityAndMetrics = async (req, res, next) => {
    let uid = req.user?.id || null;
    // 1. User Activity (guard req.body/req.query which may be undefined)
    const bodyUserId = req.body && req.body.userId;
    const queryUserId = req.query && req.query.userId;
    if (!uid && (bodyUserId || queryUserId)) {
      uid = bodyUserId || queryUserId;
      try { await User.findOneAndUpdate({ id: uid }, { lastActive: new Date() }); } catch (e) { console.error('User update error', e); }
    } else if (uid) {
      try { await User.findOneAndUpdate({ id: uid }, { lastActive: new Date() }); } catch (e) { console.error('User update error', e); }
    }

  // 2. API Metrics
  const route = req.path;
  const method = req.method;
  const today = new Date();
  const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  // Don't track static files or metrics calls themselves to avoid loops/noise
  if (route.startsWith('/api') && !route.includes('/metrics')) {
     try {
       // Track aggregate route usage
       await Metric.findOneAndUpdate(
         { route, method, month, userId: uid || 'anonymous' },
         { $inc: { count: 1 } },
         { upsert: true, new: true }
       );
     } catch (e) { console.error('Metric Error', e); }
  }

  next();
};
app.use(trackActivityAndMetrics);

// --- Auth Routes ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { password, ...userData } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const user = new User({ ...userData, password: hashedPassword });
    await user.save();
    
    const { password: _, ...userWithoutPass } = user.toObject();
    const token = createToken(userWithoutPass);
    res.json({ ...userWithoutPass, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, secondPassword } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Developer 2FA Check
    if (user.role === 'DEVELOPER') {
      if (!secondPassword) {
        return res.status(403).json({ error: 'Two-step verification required', require2FA: true });
      }
      const isSecondMatch = await bcrypt.compare(secondPassword, user.secondPassword);
      if (!isSecondMatch) {
        return res.status(400).json({ error: 'Invalid security code' });
      }
    }

    // Update active
    user.lastActive = new Date();
    await user.save();

    const { password: _, secondPassword: __, ...userWithoutPass } = user.toObject();
    const token = createToken(userWithoutPass);
    res.json({ ...userWithoutPass, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Metrics & Stats Routes ---
app.get('/api/metrics', async (req, res) => {
  try {
     const today = new Date();
     const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
     
     const metrics = await Metric.find({ month });
     const totalCalls = metrics.reduce((acc, curr) => acc + curr.count, 0);
     
     // Group by route for the chart
     const routeMap = {};
     metrics.forEach(m => {
       const key = `${m.method} ${m.route}`;
       routeMap[key] = (routeMap[key] || 0) + m.count;
     });
     
     const routes = Object.keys(routeMap).map(k => {
       const [method, route] = k.split(' ');
       return { method, route, count: routeMap[k] };
     });

     res.json({
       totalMonth: totalCalls,
       routes: routes
     });
  } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/metrics/users', async (req, res) => {
  try {
    const today = new Date();
    const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    
    const metrics = await Metric.find({ month });
    const userMap = {};
    
    metrics.forEach(m => {
      if (m.userId && m.userId !== 'anonymous') {
        userMap[m.userId] = (userMap[m.userId] || 0) + m.count;
      }
    });

    const userIds = Object.keys(userMap);
    const users = await User.find({ id: { $in: userIds } }, 'id username fullName role');

    const result = users.map(u => ({
      ...u.toObject(),
      count: userMap[u.id] || 0
    })).sort((a, b) => b.count - a.count).slice(0, 10); // Top 10

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/storage', async (req, res) => {
  try {
    // Approximate storage usage by converting docs to JSON string length
    const [chats, users, submissions, quizzes, results, violations, groups, classroomGroups] = await Promise.all([
      Chat.find(), User.find(), Submission.find(), Quiz.find(), QuizResult.find(), TestViolation.find(), StudentGroup.find(), ClassroomGroup.find()
    ]);

    const calcSize = (docs) => JSON.stringify(docs).length;

    const stats = {
      chats: calcSize(chats) + calcSize(classroomGroups), // Include group chats
      users: calcSize(users) + calcSize(groups),
      submissions: calcSize(submissions),
      testData: calcSize(quizzes) + calcSize(results) + calcSize(violations),
    };
    
    stats.total = Object.values(stats).reduce((a, b) => a + b, 0);
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- Generic CRUD Helpers ---
const createCrud = (Model, route) => {
  app.get(`/api/${route}`, async (req, res) => {
    try {
      const items = await Model.find();
      res.json(items);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.post(`/api/${route}`, async (req, res) => {
    try {
      const item = new Model(req.body);
      await item.save();
      res.json(item);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.put(`/api/${route}/:id`, async (req, res) => {
    try {
      const item = await Model.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
      res.json(item);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  app.delete(`/api/${route}/:id`, async (req, res) => {
      try {
        await Model.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
      } catch (err) { res.status(500).json({ error: err.message }); }
  });
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const slotRangesOverlap = (aSlot, aDuration, bSlot, bDuration) => {
  const aStart = Number(aSlot) || 0;
  const aEnd = aStart + Math.max(1, Number(aDuration) || 1);
  const bStart = Number(bSlot) || 0;
  const bEnd = bStart + Math.max(1, Number(bDuration) || 1);
  return aStart < bEnd && bStart < aEnd;
};
const findTeacherConflicts = (candidateTimetable, existingTimetables = []) => {
  const candidateEntries = Array.isArray(candidateTimetable?.entries) ? candidateTimetable.entries : [];
  const candidateId = String(candidateTimetable?.id || '');
  const conflicts = [];

  candidateEntries.forEach((entry) => {
    const teacher = normalizeText(entry?.teacherName);
    const day = normalizeText(entry?.day);
    if (!teacher || !day) return;

    for (const timetable of existingTimetables) {
      if (String(timetable?.id || '') === candidateId) continue;
      const rows = Array.isArray(timetable?.entries) ? timetable.entries : [];
      for (const other of rows) {
        if (normalizeText(other?.teacherName) !== teacher) continue;
        if (normalizeText(other?.day) !== day) continue;
        if (!slotRangesOverlap(entry?.slotIndex, entry?.duration, other?.slotIndex, other?.duration)) continue;
        conflicts.push({
          teacherName: entry.teacherName || other.teacherName || 'Unknown',
          day: entry.day || other.day || '',
          slotIndex: Number(entry.slotIndex) || 0,
          duration: Math.max(1, Number(entry.duration) || 1),
          conflictWith: {
            timetableId: timetable.id,
            department: timetable.department,
            collegeYear: timetable.collegeYear,
            semester: timetable.semester,
            division: timetable.division,
            slotIndex: Number(other.slotIndex) || 0,
            duration: Math.max(1, Number(other.duration) || 1),
            subjectName: other.subjectName || ''
          }
        });
        return;
      }
    }
  });

  return conflicts;
};

createCrud(Project, 'projects');
// Student groups with sequential group numbers per dept/semester/division
app.get('/api/groups', async (req, res) => {
  try {
    const items = await StudentGroup.find();
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/groups', async (req, res) => {
  try {
    const payload = req.body || {};
    const department = String(payload.department || '').trim();
    const division = String(payload.division || '').trim();
    const semester = Number(payload.semester || 0);
    const collegeYear = Number(payload.collegeYear || 0);

    const sameBucket = await StudentGroup.find({
      department,
      division,
      semester
    });
    const maxGroupNo = (sameBucket || []).reduce((max, g) => Math.max(max, Number(g.groupNo) || 0), 0);
    const groupNo = maxGroupNo + 1;

    const item = new StudentGroup({
      ...payload,
      department,
      division,
      semester,
      collegeYear,
      groupNo
    });
    await item.save();
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/groups/:id', async (req, res) => {
  try {
    const existing = await StudentGroup.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Group not found' });
    const payload = { ...req.body, groupNo: existing.groupNo };
    const item = await StudentGroup.findOneAndUpdate({ id: req.params.id }, payload, { new: true });
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/groups/:id', async (req, res) => {
  try {
    const groupId = req.params.id;
    const assignments = await Assignment.find({ groupId });
    await StudentGroup.findOneAndDelete({ id: groupId });
    await Assignment.deleteMany({ groupId });
    const assignmentIds = assignments.map(a => a.id);
    if (assignmentIds.length) {
      await Submission.deleteMany({ assignmentId: { $in: assignmentIds } });
      await ProjectIdea.deleteMany({ assignmentId: { $in: assignmentIds } });
    }
    await MarkEntry.deleteMany({ groupId });
    await Chat.deleteMany({ targetType: 'GROUP', targetId: groupId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
createCrud(Assignment, 'assignments');
createCrud(Submission, 'submissions');
createCrud(TestAssignment, 'test-assignments');
createCrud(QuizResult, 'results');
createCrud(TestViolation, 'violations');
createCrud(MarkEntry, 'marks');
createCrud(ProjectIdea, 'project-ideas');
createCrud(ClassroomGroup, 'classroom-groups');
createCrud(Report, 'reports');

// Timetable routes with cross-timetable teacher overlap validation
app.get('/api/timetables', async (req, res) => {
  try {
    const rows = await Timetable.find();
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/timetables', async (req, res) => {
  try {
    const payload = req.body || {};
    const allTimetables = await Timetable.find();
    const conflicts = findTeacherConflicts(payload, allTimetables);
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'Teacher timetable conflict detected. Same teacher cannot have overlapping lectures across timetables.',
        conflicts
      });
    }

    const item = new Timetable(payload);
    await item.save();
    res.json(item);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/timetables/:id', async (req, res) => {
  try {
    const existing = await Timetable.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Timetable not found' });

    const payload = { ...req.body, id: req.params.id };
    const allTimetables = await Timetable.find();
    const conflicts = findTeacherConflicts(payload, allTimetables);
    if (conflicts.length > 0) {
      return res.status(409).json({
        error: 'Teacher timetable conflict detected. Same teacher cannot have overlapping lectures across timetables.',
        conflicts
      });
    }

    const updated = await Timetable.findOneAndUpdate({ id: req.params.id }, payload, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/timetables/:id', async (req, res) => {
  try {
    await Timetable.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Quiz routes with assignment sync and safe delete semantics
app.get('/api/quizzes', async (req, res) => {
  try {
    const quizzes = await Quiz.find();
    res.json(quizzes);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/quizzes', async (req, res) => {
  try {
    const quiz = new Quiz(req.body);
    await quiz.save();
    res.json(quiz);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/quizzes/:id', async (req, res) => {
  try {
    const existing = await Quiz.findOne({ id: req.params.id });
    if (!existing) return res.status(404).json({ error: 'Quiz not found' });

    const updated = await Quiz.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (updated && updated.title && updated.title !== existing.title) {
      await TestAssignment.updateMany({ quizId: updated.id }, { quizTitle: updated.title });
    }
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/quizzes/:id', async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({ id: req.params.id });
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });

    await QuizResult.updateMany(
      { quizId: req.params.id, $or: [{ teacherId: { $exists: false } }, { teacherId: '' }, { teacherId: null }] },
      { teacherId: quiz.createdBy }
    );

    // Remove assignments for deleted quiz from teacher/student assigned views.
    // Keep results/submissions so they can be managed from Submitted tab.
    await TestAssignment.deleteMany({ quizId: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Classroom group message routes (incremental sync + file support)
app.get('/api/classroom-groups/:id/messages', async (req, res) => {
  try {
    const group = await ClassroomGroup.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const since = req.query.since;
    const messages = (group.messages || []).filter(m => !since || m.timestamp > since);
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/classroom-groups/:id/messages', async (req, res) => {
  try {
    const group = await ClassroomGroup.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const {
      id,
      senderId,
      senderName,
      role = 'TEACHER',
      message = '',
      fileName = '',
      fileType = '',
      fileData = '',
      timestamp
    } = req.body;

    const isGroupOwner = senderId === group.teacherId;
    const isJoinedMember = (group.studentIds || []).includes(senderId);
    if (!isGroupOwner && !isJoinedMember) {
      return res.status(403).json({ error: 'Only joined members can send classroom messages' });
    }

    const trimmedMessage = String(message).trim();
    if (!trimmedMessage && !fileData) {
      return res.status(400).json({ error: 'Message or file is required' });
    }

    const messageEntry = {
      id: id || `cm${Date.now()}`,
      senderId,
      senderName,
      role,
      message: trimmedMessage,
      fileName,
      fileType,
      fileData,
      timestamp: timestamp || new Date().toISOString()
    };

    group.messages = [...(group.messages || []), messageEntry];
    await group.save();
    res.json(messageEntry);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/classroom-groups/:id/messages/:messageId', async (req, res) => {
  try {
    const group = await ClassroomGroup.findOne({ id: req.params.id });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const requesterId = req.query.requesterId;
    const target = (group.messages || []).find(m => m.id === req.params.messageId);
    if (!target) {
      return res.status(404).json({ error: 'Message not found' });
    }
    const isGroupOwner = requesterId === group.teacherId;
    const isSender = requesterId === target.senderId;
    if (!isGroupOwner && !isSender) {
      return res.status(403).json({ error: 'Only sender or group owner can delete this message' });
    }
    group.messages = (group.messages || []).filter(m => m.id !== req.params.messageId);
    await group.save();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Special Delete for Violations (Delete All)
app.delete('/api/violations', async (req, res) => {
  try {
    await TestViolation.deleteMany({});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Prune Old Results
app.delete('/api/results/prune', async (req, res) => {
  try {
    const { months } = req.body;
    if (!months) return res.status(400).json({ error: 'Months required' });
    
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - parseInt(months));
    
    // Note: Date stored as ISO string, so string comparison works for simplified checking or filter via JS
    // Mongoose query might be tricky with string dates, so we fetch and filter or rely on consistent ISO format.
    // For reliability in this mock setup, we fetch all and delete IDs.
    const allResults = await QuizResult.find();
    const toDelete = allResults.filter(r => new Date(r.date) < cutoffDate).map(r => r.id);
    
    await QuizResult.deleteMany({ id: { $in: toDelete } });
    
    res.json({ deletedCount: toDelete.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/results/bulk-delete', async (req, res) => {
  try {
    const { quizId, quizTitle, teacherId } = req.body || {};
    if (!quizId && !quizTitle) {
      return res.status(400).json({ error: 'quizId or quizTitle is required' });
    }

    const query = {};
    if (quizId) query.quizId = quizId;
    if (!quizId && quizTitle) query.quizTitle = quizTitle;
    if (teacherId) query.teacherId = teacherId;

    const out = await QuizResult.deleteMany(query);
    res.json({ success: true, deletedCount: out.deletedCount || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// User Management Routes
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}, '-password -secondPassword');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    // Prevent updating password via this route
    delete updates.password;
    delete updates.secondPassword;
    
    const user = await User.findOneAndUpdate({ id }, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const { password: _, secondPassword: __, ...userWithoutPass } = user.toObject();
    res.json(userWithoutPass);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/online', async (req, res) => {
  try {
    // Users active in last 5 minutes
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const users = await User.find({ lastActive: { $gte: fiveMinAgo } }, 'fullName role username');
    res.json(users);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Chat routes (existing)
app.get('/api/chats', async (req, res) => {
  try {
    const { since, targetId, targetType } = req.query;
    const query = {};
    if (since) query.timestamp = { $gt: since };
    if (targetId) query.targetId = targetId;
    if (targetType) query.targetType = targetType;

    const chats = await Chat.find(query).sort({ timestamp: 1 });
    const decryptedChats = chats.map(chat => ({
      id: chat.id,
      senderId: chat.senderId,
      senderName: chat.senderName,
      targetId: chat.targetId,
      targetType: chat.targetType,
      message: chat.encryptedMessage && chat.iv
        ? decrypt({ content: chat.encryptedMessage, iv: chat.iv })
        : '',
      fileName: chat.fileName || '',
      fileType: chat.fileType || '',
      fileData: chat.fileData || '',
      timestamp: chat.timestamp
    }));
    res.json(decryptedChats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete all reports
app.delete('/api/reports/all', async (req, res) => {
  try {
    await Report.deleteMany({});
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/chats', async (req, res) => {
  try {
    const { message = '', fileName = '', fileType = '', fileData = '', ...chatData } = req.body;
    if (fileData) {
      return res.status(400).json({ error: 'File sharing is disabled in project guide chat' });
    }
    const trimmedMessage = String(message).trim();
    if (!trimmedMessage) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const { content, iv } = encrypt(trimmedMessage);
    
    const chat = new Chat({
      ...chatData,
      encryptedMessage: content,
      iv: iv,
      fileName: '',
      fileType: '',
      fileData: ''
    });
    await chat.save();
    
    res.json({ ...chatData, message: trimmedMessage, fileName: '', fileType: '', fileData: '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/chats/:id', async (req, res) => {
    try {
        await Chat.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
