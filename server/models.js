const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  secondPassword: { type: String }, // For Developer 2FA
  role: { type: String, enum: ['ADMIN', 'TEACHER', 'STUDENT', 'DEVELOPER'], required: true },
  department: { type: String, required: true },
  fullName: { type: String, required: true },
  division: String,
  prn: String,
  collegeYear: Number, // 1-4
  semester: Number,    // 1-8
  lastActive: Date // For "Users Online"
});

const ProjectSchema = new mongoose.Schema({
  id: String,
  title: String,
  description: String,
  department: String,
  guideId: String,
  dueDate: String,
  createdBy: String,
  totalMarks: Number,
  rubrics: [{
    id: String,
    title: String,
    maxMarks: Number
  }]
});

const StudentGroupSchema = new mongoose.Schema({
  id: String,
  groupNo: Number,
  groupLeader: String,
  department: String,
  collegeYear: Number,
  semester: Number,
  division: String,
  groupSize: Number,
  members: [String]
});

// Classroom Groups (Teacher <-> Students)
const ClassroomGroupSchema = new mongoose.Schema({
  id: String,
  name: String,
  joinKey: { type: String, unique: true },
  teacherId: String,
  teacherName: String,
  studentIds: [String], // Array of User IDs (Students & Other Teachers)
  messages: [{
    id: String,
    senderId: String,
    senderName: String,
    role: String, // To identify if sender is Teacher/Student
    message: String,
    fileName: String,
    fileType: String,
    fileData: String,
    timestamp: String
  }]
});

const AssignmentSchema = new mongoose.Schema({
  id: String,
  projectId: String,
  groupId: String,
  assignedBy: String,
  status: { type: String, enum: ['ASSIGNED', 'SUBMITTED', 'GRADED'] },
  assignedDate: String,
  progress: { type: Number, default: 0 } // Shared progress (0-100)
});

const SubmissionSchema = new mongoose.Schema({
  id: String,
  assignmentId: String,
  submittedBy: String,
  submissionDate: String,
  topicName: String,
  link: String,      // URL submission
  fileName: String,  // Simulated file name
  grade: String
});

const ProjectIdeaSchema = new mongoose.Schema({
  id: String,
  assignmentId: String,
  groupId: String,
  submittedBy: String,
  ideaTitle: String,
  submittedAt: String,
  status: { type: String, enum: ['PENDING', 'APPROVED', 'CHANGES_REQUESTED'], default: 'PENDING' },
  reviewedBy: String,
  reviewedByName: String,
  reviewedAt: String
});

const ChatSchema = new mongoose.Schema({
  id: String,
  senderId: String,
  senderName: String,
  targetId: String,
  targetType: { type: String, enum: ['GROUP', 'DIVISION'] },
  encryptedMessage: String,
  iv: String,
  fileName: String,
  fileType: String,
  fileData: String,
  timestamp: String
});

// Quiz Template
const QuizSchema = new mongoose.Schema({
  id: String,
  title: String,
  createdBy: String, // Teacher ID
  collegeYear: Number,
  semester: Number,
  questions: [{
    id: String,
    text: String,
    options: [String],
    correctOption: Number
  }],
  timeLimit: Number // in minutes
});

// Active Assignment of a Quiz to a Class
const TestAssignmentSchema = new mongoose.Schema({
  id: String,
  quizId: String,
  quizTitle: String,
  assignedBy: String,
  division: String,
  department: String,
  assignedDate: String,
  isActive: { type: Boolean, default: false } // Teacher toggles this
});

const QuizResultSchema = new mongoose.Schema({
  id: String,
  quizId: String,
  quizTitle: String,
  teacherId: String,
  studentId: String,
  studentName: String,
  // Snapshot fields for reporting
  prn: String,
  division: String,
  department: String,
  collegeYear: Number,
  semester: Number,
  
  score: Number,
  totalQuestions: Number,
  date: String,
  submissionType: { type: String, default: 'NORMAL' } // NORMAL or VIOLATION_AUTO_SUBMIT
});

const TestViolationSchema = new mongoose.Schema({
  id: String,
  quizId: String, // Link to specific quiz
  studentName: String,
  testName: String,
  timestamp: String
});

const MarkEntrySchema = new mongoose.Schema({
  id: String,
  groupId: String,
  projectId: String,
  teacherMarks: Number,
  isSubmittedToAdmin: Boolean,
  adminMarks: Number,
  projectLink: String,
  rubrics: String, // Reason for marks
  rubricScores: [{
    title: String,
    maxMarks: Number,
    obtainedMarks: Number
  }],
  progress: { type: Number, default: 0 } // Teacher's view/override
});

const TimetableSchema = new mongoose.Schema({
  id: String,
  createdBy: String,
  createdByName: String,
  department: String,
  collegeYear: Number,
  semester: Number,
  division: String,
  lunchSlotIndex: Number,
  constraints: [{
    id: String,
    subjectName: String,
    teacherName: String,
    type: { type: String, enum: ['SUBJECT', 'LAB'] },
    frequencyPerWeek: Number
  }],
  entries: [{
    blockId: String,
    subjectName: String,
    teacherName: String,
    type: { type: String, enum: ['SUBJECT', 'LAB'] },
    duration: Number,
    color: String,
    day: String,
    slotIndex: Number
  }],
  deletedEntries: [{
    blockId: String,
    subjectName: String,
    teacherName: String,
    type: { type: String, enum: ['SUBJECT', 'LAB'] },
    duration: Number,
    color: String
  }],
  addedEntries: [{
    blockId: String,
    subjectName: String,
    teacherName: String,
    type: { type: String, enum: ['SUBJECT', 'LAB'] },
    frequencyPerWeek: Number,
    duration: Number,
    color: String
  }],
  createdAt: String,
  updatedAt: String
});

const ReportSchema = new mongoose.Schema({
  id: String,
  userId: String,
  userName: String,
  userRole: String,
  department: String,
  glitch: String,
  suggestion: String,
  createdAt: String
});

const MetricSchema = new mongoose.Schema({
  route: String,
  method: String,
  userId: String, // New: Track who made the call
  month: String, // "YYYY-MM"
  count: { type: Number, default: 0 }
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Project: mongoose.model('Project', ProjectSchema),
  StudentGroup: mongoose.model('StudentGroup', StudentGroupSchema),
  ClassroomGroup: mongoose.model('ClassroomGroup', ClassroomGroupSchema),
  Assignment: mongoose.model('Assignment', AssignmentSchema),
  Submission: mongoose.model('Submission', SubmissionSchema),
  Chat: mongoose.model('Chat', ChatSchema),
  Quiz: mongoose.model('Quiz', QuizSchema),
  TestAssignment: mongoose.model('TestAssignment', TestAssignmentSchema),
  QuizResult: mongoose.model('QuizResult', QuizResultSchema),
  TestViolation: mongoose.model('TestViolation', TestViolationSchema),
  MarkEntry: mongoose.model('MarkEntry', MarkEntrySchema),
  ProjectIdea: mongoose.model('ProjectIdea', ProjectIdeaSchema),
  Timetable: mongoose.model('Timetable', TimetableSchema),
  Report: mongoose.model('Report', ReportSchema),
  Metric: mongoose.model('Metric', MetricSchema)
};
