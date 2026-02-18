import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../components/Layout.jsx';
import { Card, Badge, Button, Input, Select } from '../components/UI.jsx';
import { ApiService } from '../services/api.js';
import { DEPARTMENTS, DIVISIONS, YEARS, getSemestersForYear } from '../constants.js';
import { CheckSquare, Users, CalendarDays, Send, Trash2, PlayCircle, StopCircle, ChevronLeft, Pencil, Download } from 'lucide-react';

const groupChatCacheKey = (groupId) => `group_chat_cache_${groupId}`;
const groupChatSyncKey = (groupId) => `group_chat_sync_${groupId}`;
const merge = (a, b) => {
  const m = new Map((a || []).map((x) => [x.id, x]));
  (b || []).forEach((x) => m.set(x.id, x));
  return Array.from(m.values()).sort((x, y) => new Date(x.timestamp) - new Date(y.timestamp));
};

export const TeacherDashboard = ({ user, onLogout }) => {
  const [tab, setTab] = useState('TEACHER');
  return (
    <Layout user={user} onLogout={onLogout} title="Teacher Dashboard">
      <div className="teacher-dashboard-surface">
        <div className="teacher-nav">
          <button onClick={() => setTab('TEACHER')} className={`teacher-nav-btn ${tab === 'TEACHER' ? 'active' : ''}`}>Teacher Tab (Classroom)</button>
          <button onClick={() => setTab('GUIDE')} className={`teacher-nav-btn ${tab === 'GUIDE' ? 'active' : ''}`}>Guide Tab (Projects)</button>
        </div>
        {tab === 'TEACHER' ? <TeacherTab user={user} /> : <GuideTab user={user} />}
      </div>
    </Layout>
  );
};

const TeacherTab = ({ user }) => {
  const [sub, setSub] = useState('TEST');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 sub-menu">
        <button onClick={() => setSub('TEST')} className={`sub-menu-btn ${sub === 'TEST' ? 'active' : ''}`}><CheckSquare size={18}/> <span>Test Management</span></button>
        <button onClick={() => setSub('TIMETABLE')} className={`sub-menu-btn ${sub === 'TIMETABLE' ? 'active' : ''}`}><CalendarDays size={18}/> <span>Timetable</span></button>
        <button onClick={() => setSub('GROUPS')} className={`sub-menu-btn ${sub === 'GROUPS' ? 'active' : ''}`}><Users size={18}/> <span>Classroom Groups</span></button>
      </div>
      <div className="lg:col-span-3">
        {sub === 'TEST' && <TestManager user={user} />}
        {sub === 'TIMETABLE' && <TimetableManager user={user} />}
        {sub === 'GROUPS' && <ClassroomGroupsManager user={user} />}
      </div>
    </div>
  );
};

export const TestManager = ({ user }) => {
  const [mode, setMode] = useState('CREATE');
  const [quizzes, setQuizzes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [results, setResults] = useState([]);
  const [violations, setViolations] = useState([]);
  const [selectedViolationTest, setSelectedViolationTest] = useState('');
  const [selectedSubmittedTest, setSelectedSubmittedTest] = useState('');
  const [editingQuizId, setEditingQuizId] = useState('');
  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [quiz, setQuiz] = useState({ title: '', timeLimit: 30, collegeYear: '', semester: '', questions: [] });
  const [q, setQ] = useState({ text: '', o1: '', o2: '', o3: '', o4: '', c: '0' });
  const [assignQuizId, setAssignQuizId] = useState('');
  const [assignDept, setAssignDept] = useState(DEPARTMENTS[0]);
  const [assignDiv, setAssignDiv] = useState(DIVISIONS[0]);
  const [submittedFilters, setSubmittedFilters] = useState({
    department: 'ALL',
    division: 'ALL',
    collegeYear: 'ALL',
    semester: 'ALL'
  });
  const emptyQuiz = { title: '', timeLimit: 30, collegeYear: '', semester: '', questions: [] };
  const emptyQuestion = { text: '', o1: '', o2: '', o3: '', o4: '', c: '0' };

  const refresh = async () => {
    const [allQ, allA, allR, allV] = await Promise.all([ApiService.getQuizzes(), ApiService.getTestAssignments(), ApiService.getQuizResults(), ApiService.getViolations()]);
    const mine = (allQ || []).filter((x) => x.createdBy === user.id);
    setQuizzes(mine);
    setAssignments((allA || []).filter((x) => x.assignedBy === user.id));
    setResults((allR || []).filter((x) => x.teacherId === user.id || mine.some((qz) => qz.id === x.quizId)));
    setViolations((allV || []).filter((x) => mine.some((qz) => qz.title === x.testName)));
  };
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (assignQuizId && !quizzes.some((z) => z.id === assignQuizId)) {
      setAssignQuizId('');
    }
  }, [assignQuizId, quizzes]);

  const addQuestion = () => {
    if (!q.text || !q.o1) return;
    const nextQuestion = { id: editingQuestionId || `q${Date.now()}`, text: q.text, options: [q.o1, q.o2, q.o3, q.o4], correctOption: Number(q.c) };
    setQuiz((p) => ({
      ...p,
      questions: editingQuestionId
        ? p.questions.map((item) => (item.id === editingQuestionId ? nextQuestion : item))
        : [...p.questions, nextQuestion]
    }));
    setQ(emptyQuestion);
    setEditingQuestionId('');
  };

  const editQuestion = (question) => {
    setEditingQuestionId(question.id);
    setQ({
      text: question.text || '',
      o1: question.options?.[0] || '',
      o2: question.options?.[1] || '',
      o3: question.options?.[2] || '',
      o4: question.options?.[3] || '',
      c: String(Number(question.correctOption) || 0)
    });
  };

  const removeQuestion = (questionId) => {
    setQuiz((prev) => ({ ...prev, questions: prev.questions.filter((item) => item.id !== questionId) }));
    if (editingQuestionId === questionId) {
      setEditingQuestionId('');
      setQ(emptyQuestion);
    }
  };

  const resetQuizEditor = () => {
    setEditingQuizId('');
    setEditingQuestionId('');
    setQuiz(emptyQuiz);
    setQ(emptyQuestion);
  };

  const openQuizForEdit = (existingQuiz) => {
    setEditingQuizId(existingQuiz.id);
    setEditingQuestionId('');
    setQ(emptyQuestion);
    setQuiz({
      title: existingQuiz.title || '',
      timeLimit: Number(existingQuiz.timeLimit) || 30,
      collegeYear: String(existingQuiz.collegeYear || ''),
      semester: String(existingQuiz.semester || ''),
      questions: existingQuiz.questions || []
    });
  };

  const saveQuiz = async () => {
    if (!quiz.title || !quiz.questions.length || !quiz.collegeYear || !quiz.semester) return;
    const payload = {
      ...quiz,
      timeLimit: Number(quiz.timeLimit),
      collegeYear: Number(quiz.collegeYear),
      semester: Number(quiz.semester)
    };
    if (editingQuizId) {
      await ApiService.updateQuiz(editingQuizId, payload);
    } else {
      await ApiService.addQuiz({ id: `qz${Date.now()}`, createdBy: user.id, ...payload });
    }
    resetQuizEditor();
    refresh();
  };

  const assignQuiz = async () => {
    const z = quizzes.find((x) => x.id === assignQuizId); if (!z) return;
    await ApiService.assignTest({ id: `ta${Date.now()}`, quizId: z.id, quizTitle: z.title, assignedBy: user.id, department: assignDept, division: assignDiv, assignedDate: new Date().toISOString(), isActive: false });
    alert('Test assigned successfully.');
    refresh();
  };

  const submittedTests = useMemo(() => {
    const map = new Map();
    (results || []).forEach((result) => {
      const key = result.quizId || result.quizTitle;
      if (!key) return;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          key,
          quizId: result.quizId,
          title: result.quizTitle || 'Untitled Test',
          count: 1,
          latestDate: result.date
        });
      } else {
        prev.count += 1;
        if (new Date(result.date || 0) > new Date(prev.latestDate || 0)) prev.latestDate = result.date;
      }
    });
    return Array.from(map.values()).sort((a, b) => new Date(b.latestDate || 0) - new Date(a.latestDate || 0));
  }, [results]);

  const selectedSubmittedRows = useMemo(() => {
    if (!selectedSubmittedTest) return [];
    return (results || []).filter((r) => (r.quizId || r.quizTitle) === selectedSubmittedTest);
  }, [results, selectedSubmittedTest]);

  const filteredSubmittedRows = useMemo(() => {
    return selectedSubmittedRows.filter((row) => {
      if (submittedFilters.department !== 'ALL' && row.department !== submittedFilters.department) return false;
      if (submittedFilters.division !== 'ALL' && row.division !== submittedFilters.division) return false;
      if (submittedFilters.collegeYear !== 'ALL' && String(row.collegeYear || '') !== submittedFilters.collegeYear) return false;
      if (submittedFilters.semester !== 'ALL' && String(row.semester || '') !== submittedFilters.semester) return false;
      return true;
    });
  }, [selectedSubmittedRows, submittedFilters]);

  const submittedFilterOptions = useMemo(() => {
    const getValues = (extractor) => [...new Set(selectedSubmittedRows.map(extractor).filter((v) => v !== undefined && v !== null && String(v).trim() !== ''))];
    return {
      departments: getValues((row) => row.department),
      divisions: getValues((row) => row.division),
      years: getValues((row) => String(row.collegeYear)).sort((a, b) => Number(a) - Number(b)),
      semesters: getValues((row) => String(row.semester)).sort((a, b) => Number(a) - Number(b))
    };
  }, [selectedSubmittedRows]);

  const clearSubmittedFilters = () => {
    setSubmittedFilters({ department: 'ALL', division: 'ALL', collegeYear: 'ALL', semester: 'ALL' });
  };

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const exportSubmittedCsv = () => {
    if (!filteredSubmittedRows.length) return;
    const header = ['Student Name', 'PRN', 'Department', 'Division', 'Year', 'Semester', 'Test Name', 'Score', 'Total Questions', 'Submission Type', 'Submitted At'];
    const rows = filteredSubmittedRows.map((row) => ([
      row.studentName,
      row.prn,
      row.department,
      row.division,
      row.collegeYear,
      row.semester,
      row.quizTitle,
      row.score,
      row.totalQuestions,
      row.submissionType || 'NORMAL',
      row.date ? new Date(row.date).toLocaleString() : ''
    ]));
    const csvText = [header, ...rows].map((line) => line.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const selected = submittedTests.find((x) => x.key === selectedSubmittedTest);
    const safeTitle = String(selected?.title || 'test').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${safeTitle || 'test'}_submissions.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const removeQuizAndAssignments = async (quizId) => {
    await ApiService.deleteQuiz(quizId);
    if (selectedSubmittedTest === quizId) setSelectedSubmittedTest('');
    if (editingQuizId === quizId) resetQuizEditor();
    refresh();
  };

  const removeAllSubmittedForTest = async (testMeta) => {
    if (!testMeta) return;
    const targetCount = (results || []).filter((r) => (r.quizId || r.quizTitle) === testMeta.key).length;
    if (!targetCount) return;
    if (!window.confirm('All submitted data for this test will be deleted.')) return;
    await ApiService.deleteQuizResultsBulk({
      quizId: testMeta.quizId || '',
      quizTitle: testMeta.title || '',
      teacherId: user.id
    });
    if (selectedSubmittedTest === testMeta.key) setSelectedSubmittedTest('');
    clearSubmittedFilters();
    refresh();
  };

  const selectedSubmittedMeta = submittedTests.find((x) => x.key === selectedSubmittedTest);

  return (
    <Card className="teacher-test-management">
      <div className="flex border-b mb-4 overflow-x-auto">
        {['CREATE', 'ASSIGN', 'ASSIGNED', 'SUBMITTED', 'VIOLATIONS'].map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setSelectedViolationTest('');
              if (m !== 'SUBMITTED') {
                setSelectedSubmittedTest('');
                clearSubmittedFilters();
              }
            }}
            className={`flex-1 py-2 px-4 text-sm font-semibold ${mode === m ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600'}`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'CREATE' && (
        <div className="space-y-4">
          <h4 className="font-semibold text-black">{editingQuizId ? 'Edit Quiz' : 'Add Question'}</h4>
          <Input label="Quiz Title" value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input label="Year" value={quiz.collegeYear} onChange={(e) => setQuiz({ ...quiz, collegeYear: e.target.value })} />
            <Input label="Semester" value={quiz.semester} onChange={(e) => setQuiz({ ...quiz, semester: e.target.value })} />
          </div>
          <Input label="Time Limit (Minutes)" type="number" value={quiz.timeLimit} onChange={(e) => setQuiz({ ...quiz, timeLimit: e.target.value })} />
          <Input label="Question" value={q.text} onChange={(e) => setQ({ ...q, text: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Option 1" value={q.o1} onChange={(e) => setQ({ ...q, o1: e.target.value })} />
            <Input placeholder="Option 2" value={q.o2} onChange={(e) => setQ({ ...q, o2: e.target.value })} />
            <Input placeholder="Option 3" value={q.o3} onChange={(e) => setQ({ ...q, o3: e.target.value })} />
            <Input placeholder="Option 4" value={q.o4} onChange={(e) => setQ({ ...q, o4: e.target.value })} />
          </div>
          <Select label="Correct" options={[0, 1, 2, 3].map((i) => ({ value: String(i), label: `Option ${i + 1}` }))} value={q.c} onChange={(e) => setQ({ ...q, c: e.target.value })} />
          <div className="flex gap-2">
            <Button onClick={addQuestion} variant="secondary" className="text-black">{editingQuestionId ? 'Update Question' : 'Add Question'}</Button>
            {editingQuestionId && <Button onClick={() => { setEditingQuestionId(''); setQ(emptyQuestion); }} variant="outline">Cancel Question Edit</Button>}
          </div>
          <div className="text-black font-semibold">Questions ({quiz.questions.length})</div>
          <div className="space-y-2">
            {(quiz.questions || []).map((question, idx) => (
              <div key={question.id} className="p-3 border rounded bg-white text-black flex justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{idx + 1}. {question.text}</div>
                  <div className="text-xs text-gray-500">Correct: Option {(Number(question.correctOption) || 0) + 1}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-indigo-600" onClick={() => editQuestion(question)}><Pencil size={14} /></button>
                  <button className="text-red-600" onClick={() => removeQuestion(question.id)}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={saveQuiz}>{editingQuizId ? 'Update Quiz Template' : 'Create Quiz Template'}</Button>
            {editingQuizId && <Button variant="outline" onClick={resetQuizEditor}>Cancel Quiz Edit</Button>}
          </div>

          <h4 className="font-semibold text-black mt-4">My Created Quizzes</h4>
          <div className="space-y-2">
            {quizzes.map((z) => (
              <div
                key={z.id}
                className={`p-2 border rounded bg-white text-black flex justify-between items-center cursor-pointer ${editingQuizId === z.id ? 'border-indigo-500 ring-1 ring-indigo-300' : ''}`}
                onClick={() => openQuizForEdit(z)}
              >
                <div>
                  <div className="font-semibold">{z.title}</div>
                  <div className="text-xs text-gray-500">Year {z.collegeYear} | Sem {z.semester} | {z.questions?.length || 0} Questions</div>
                </div>
                <button
                  className="text-red-600"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await removeQuizAndAssignments(z.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {mode === 'ASSIGN' && (
        <div className="space-y-3 max-w-xl">
          <Select label="Quiz" options={quizzes.map((z) => ({ value: z.id, label: z.title }))} value={assignQuizId} onChange={(e) => setAssignQuizId(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Department" options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} value={assignDept} onChange={(e) => setAssignDept(e.target.value)} />
            <Select label="Division" options={DIVISIONS.map((d) => ({ value: d, label: d }))} value={assignDiv} onChange={(e) => setAssignDiv(e.target.value)} />
          </div>
          <Button onClick={assignQuiz}>Assign</Button>
        </div>
      )}

      {mode === 'ASSIGNED' && (
        <div className="space-y-2">
          {assignments.map((a) => (
            <div key={a.id} className="p-3 border rounded bg-white text-black flex justify-between items-center">
              <div>
                <div className="font-semibold">{a.quizTitle}</div>
                <div className="text-xs text-gray-500">{a.department} - {a.division}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant={a.isActive ? 'danger' : 'primary'} onClick={async () => { await ApiService.updateTestAssignment(a.id, { isActive: !a.isActive }); refresh(); }}>
                  {a.isActive ? <><StopCircle size={14} />Stop</> : <><PlayCircle size={14} />Start</>}
                </Button>
                <button className="text-red-600" onClick={async () => { await ApiService.deleteTestAssignment(a.id); refresh(); }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'SUBMITTED' && (
        !selectedSubmittedTest ? (
          <div className="space-y-2">
            <div className="font-bold text-black">Submitted Tests</div>
            {submittedTests.length === 0 && <div className="text-sm text-gray-500">No submissions yet.</div>}
            {submittedTests.map((test) => (
              <div key={test.key} className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center text-black" onClick={() => { setSelectedSubmittedTest(test.key); clearSubmittedFilters(); }}>
                <span className="font-semibold">{test.title}</span>
                <div className="flex items-center gap-2">
                  <Badge color="blue">{test.count}</Badge>
                  <button
                    className="text-red-600"
                    title="Delete all submitted data for this test"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await removeAllSubmittedForTest(test);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button className="text-black dark:text-white" onClick={() => setSelectedSubmittedTest('')}><ChevronLeft /></button>
                <div className="font-bold text-black">{selectedSubmittedMeta?.title || 'Submitted Test'} - Submissions</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportSubmittedCsv} disabled={!filteredSubmittedRows.length}><Download size={14} />Export CSV</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <Select label="Department" options={[{ value: 'ALL', label: 'All' }, ...submittedFilterOptions.departments.map((v) => ({ value: v, label: v }))]} value={submittedFilters.department} onChange={(e) => setSubmittedFilters((prev) => ({ ...prev, department: e.target.value }))} />
              <Select label="Division" options={[{ value: 'ALL', label: 'All' }, ...submittedFilterOptions.divisions.map((v) => ({ value: v, label: v }))]} value={submittedFilters.division} onChange={(e) => setSubmittedFilters((prev) => ({ ...prev, division: e.target.value }))} />
              <Select label="Year" options={[{ value: 'ALL', label: 'All' }, ...submittedFilterOptions.years.map((v) => ({ value: v, label: v }))]} value={submittedFilters.collegeYear} onChange={(e) => setSubmittedFilters((prev) => ({ ...prev, collegeYear: e.target.value }))} />
              <Select label="Semester" options={[{ value: 'ALL', label: 'All' }, ...submittedFilterOptions.semesters.map((v) => ({ value: v, label: v }))]} value={submittedFilters.semester} onChange={(e) => setSubmittedFilters((prev) => ({ ...prev, semester: e.target.value }))} />
              <div className="ui-input-wrapper">
                <label className="ui-label opacity-0 select-none">Clear</label>
                <Button variant="secondary" className="text-black w-full" onClick={clearSubmittedFilters}>Clear Filters</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase text-black">
                  <tr>
                    <th className="px-3 py-2">Student</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Division</th>
                    <th className="px-3 py-2">Year</th>
                    <th className="px-3 py-2">Semester</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmittedRows.map((r) => (
                    <tr key={r.id} className="border-b text-black">
                      <td className="px-3 py-2">{r.studentName}</td>
                      <td className="px-3 py-2">{r.department || '-'}</td>
                      <td className="px-3 py-2">{r.division || '-'}</td>
                      <td className="px-3 py-2">{r.collegeYear || '-'}</td>
                      <td className="px-3 py-2">{r.semester || '-'}</td>
                      <td className="px-3 py-2">{r.score}/{r.totalQuestions}</td>
                      <td className="px-3 py-2">{r.date ? new Date(r.date).toLocaleString() : '-'}</td>
                    </tr>
                  ))}
                  {filteredSubmittedRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-500">No matching submissions.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {mode === 'VIOLATIONS' && (!selectedViolationTest ? <div className="space-y-2"><div className="font-bold text-black">Tests with Violations</div>{[...new Set(violations.map((v)=>v.testName))].map((t)=><div key={t} className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between text-black" onClick={()=>setSelectedViolationTest(t)}><span>{t}</span><Badge color="red">{violations.filter((v)=>v.testName===t).length}</Badge></div>)}</div> : <div><div className="flex items-center gap-2 mb-2"><button className="text-black dark:text-white" onClick={()=>setSelectedViolationTest('')}><ChevronLeft/></button><div className="font-bold text-black">{selectedViolationTest} - Violations</div></div><div className="space-y-1">{Object.entries(violations.filter((v)=>v.testName===selectedViolationTest).reduce((a,v)=>{a[v.studentName]=(a[v.studentName]||0)+1;return a;},{})).map(([name,c])=><div key={name} className="p-2 border rounded flex justify-between text-black"><span>{name}</span><span>{c}</span></div>)}</div></div>)}
    </Card>
  );
};

const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TIMETABLE_SLOT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const formatHour12 = (hour24) => {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:00 ${period}`;
};
const TIMETABLE_SLOTS = TIMETABLE_SLOT_HOURS.map((h) => `${formatHour12(h)} - ${formatHour12(h + 1)}`);
const timetableKey = (x) => `${x.department}|${x.collegeYear}|${x.semester}|${x.division}`;
const slotKey = (day, slotIndex) => `${day}|${slotIndex}`;
const teacherTimetablesCacheKey = (userId) => `teacher_timetables_cache_${userId}`;
const cloneEntries = (rows) => (rows || []).map((x) => ({ ...x }));
const dayIndex = (day) => TIMETABLE_DAYS.indexOf(day);
const overlaps = (entry, day, slotIndex, duration) => {
  if (entry.day !== day) return false;
  const a1 = Number(entry.slotIndex);
  const a2 = a1 + Math.max(1, Number(entry.duration) || 1) - 1;
  const b1 = Number(slotIndex);
  const b2 = b1 + Math.max(1, Number(duration) || 1) - 1;
  return !(b2 < a1 || b1 > a2);
};
const canPlaceEntry = (entries, movingEntry, day, slotIndex, lunchSlotIndex, ignoreBlockId) => {
  const duration = Math.max(1, Number(movingEntry.duration) || 1);
  if (slotIndex < 0 || (slotIndex + duration) > TIMETABLE_SLOTS.length) return false;
  for (let i = 0; i < duration; i++) {
    if (slotIndex + i === Number(lunchSlotIndex)) return false;
  }
  return !(entries || []).some((entry) => {
    if (ignoreBlockId && entry.blockId === ignoreBlockId) return false;
    return overlaps(entry, day, slotIndex, duration);
  });
};
const findTeacherConflictAcrossTimetables = ({
  allTimetables,
  teacherName,
  day,
  slotIndex,
  duration,
  excludeTimetableId
}) => {
  const teacher = normalize(teacherName);
  if (!teacher) return null;
  for (const tt of (allTimetables || [])) {
    if (excludeTimetableId && String(tt?.id) === String(excludeTimetableId)) continue;
    for (const entry of (tt?.entries || [])) {
      if (normalize(entry?.teacherName) !== teacher) continue;
      if (!overlaps(entry, day, slotIndex, duration)) continue;
      return {
        timetableId: tt.id,
        department: tt.department,
        collegeYear: tt.collegeYear,
        semester: tt.semester,
        division: tt.division,
        subjectName: entry.subjectName,
        slotIndex: Number(entry.slotIndex) || 0,
        duration: Math.max(1, Number(entry.duration) || 1)
      };
    }
  }
  return null;
};
const buildGrid = (entries = []) => {
  const grid = {};
  entries.forEach((entry) => {
    const duration = Math.max(1, Number(entry.duration) || 1);
    for (let i = 0; i < duration; i++) {
      grid[slotKey(entry.day, Number(entry.slotIndex) + i)] = {
        ...entry,
        isHead: i === 0,
        isContinuation: i > 0
      };
    }
  });
  return grid;
};
const normalize = (text) => String(text || '').trim().toLowerCase();
const durationFromType = (type) => (type === 'LAB' ? 2 : 1);
const lectureKey = (subjectName, type, teacherName = '') => `${normalize(subjectName)}|${normalize(type)}|${normalize(teacherName)}`;
const colorFromIndex = (index, total) => {
  const safeTotal = Math.max(1, Number(total) || 1);
  const hue = Math.round((index * 360) / safeTotal) % 360;
  return `hsl(${hue}, 78%, 84%)`;
};
const colorForLecture = (subjectName, type, teacherName = '') => {
  const key = lectureKey(subjectName, type, teacherName);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 74%, 84%)`;
};
const makeRng = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};
const shuffleWith = (arr, rand) => {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};
const dayGapCount = (entries, day, lunchSlotIndex) => {
  const slots = (entries || [])
    .filter((entry) => entry.day === day)
    .flatMap((entry) => {
      const start = Number(entry.slotIndex) || 0;
      const duration = Math.max(1, Number(entry.duration) || 1);
      return Array.from({ length: duration }, (_, i) => start + i);
    })
    .filter((slot) => slot !== Number(lunchSlotIndex));
  if (slots.length <= 1) return 0;
  const uniq = Array.from(new Set(slots)).sort((a, b) => a - b);
  return uniq[uniq.length - 1] - uniq[0] + 1 - uniq.length;
};
const isContiguousDay = (entries, day, lunchSlotIndex) => dayGapCount(entries, day, lunchSlotIndex) === 0;
const autoGenerateEntries = (
  constraints,
  lunchSlotIndex,
  allTimetables = [],
  excludeTimetableId = '',
  options = {}
) => {
  const requestedBlocks = (constraints || []).reduce((sum, c) => sum + Math.max(1, Number(c.frequencyPerWeek) || 1), 0);
  const attemptCount = Math.max(1, Number(options.attempts) || 10);
  const baseSeed = Number(options.seed) || Date.now() + Math.floor(Math.random() * 100000);
  const dayCount = TIMETABLE_DAYS.length;
  const fixedEntries = (options.fixedEntries || []).map((entry) => ({
    ...entry,
    duration: Math.max(1, Number(entry.duration) || durationFromType(entry.type)),
    color: entry.color || colorForLecture(entry.subjectName, entry.type, entry.teacherName)
  }));
  const lectureKeys = [...new Set((constraints || []).map((c) => lectureKey(c.subjectName, c.type, c.teacherName)))];
  const colorByLecture = new Map(lectureKeys.map((key, index) => [key, colorFromIndex(index, lectureKeys.length)]));

  const sortedConstraints = [...(constraints || [])].sort((a, b) => {
    const af = Math.max(1, Number(a.frequencyPerWeek) || 1);
    const bf = Math.max(1, Number(b.frequencyPerWeek) || 1);
    const ad = Math.max(1, Number(a.duration) || durationFromType(a.type));
    const bd = Math.max(1, Number(b.duration) || durationFromType(b.type));
    if (bf !== af) return bf - af;
    if (bd !== ad) return bd - ad;
    return lectureKey(a.subjectName, a.type, a.teacherName).localeCompare(lectureKey(b.subjectName, b.type, b.teacherName));
  });

  let bestEntries = [];
  for (let attempt = 0; attempt < attemptCount; attempt++) {
    const rand = makeRng(baseSeed + attempt * 9973);
    const entries = [...fixedEntries];
    const dayLoad = Object.fromEntries(TIMETABLE_DAYS.map((day) => [day, 0]));
    fixedEntries.forEach((entry) => {
      const day = entry.day;
      if (!day) return;
      dayLoad[day] = (dayLoad[day] || 0) + Math.max(1, Number(entry.duration) || 1);
    });
    const fixedDayContiguous = Object.fromEntries(
      TIMETABLE_DAYS.map((day) => [day, isContiguousDay(fixedEntries, day, lunchSlotIndex)])
    );
    const perLectureDayCount = new Map();

    const randomizedConstraints = shuffleWith(sortedConstraints, rand);

    randomizedConstraints.forEach((constraint) => {
      const freq = Math.max(1, Number(constraint.frequencyPerWeek) || 1);
      const duration = Math.max(1, Number(constraint.duration) || durationFromType(constraint.type));
      const key = lectureKey(constraint.subjectName, constraint.type, constraint.teacherName);
      if (!perLectureDayCount.has(key)) {
        perLectureDayCount.set(key, Object.fromEntries(TIMETABLE_DAYS.map((day) => [day, 0])));
      }
      const lectureDayLoad = perLectureDayCount.get(key);

      for (let i = 0; i < freq; i++) {
        let placed = false;
        const pivot = (i + Math.floor(rand() * dayCount)) % dayCount;
        const candidateDays = [...TIMETABLE_DAYS].sort((a, b) => {
          const ad = lectureDayLoad[a] || 0;
          const bd = lectureDayLoad[b] || 0;
          if (ad !== bd) return ad - bd;
          const al = dayLoad[a] || 0;
          const bl = dayLoad[b] || 0;
          if (al !== bl) return al - bl;
          const ai = (dayIndex(a) - pivot + dayCount) % dayCount;
          const bi = (dayIndex(b) - pivot + dayCount) % dayCount;
          if (ai !== bi) return ai - bi;
          return rand() < 0.5 ? -1 : 1;
        });

        for (const day of candidateDays) {
          const slotOrder = shuffleWith(TIMETABLE_SLOTS.map((_, idx) => idx), rand)
            .map((slot) => {
              const candidate = {
                blockId: `tmp_${constraint.id}_${i}_${day}_${slot}_${attempt}`,
                subjectName: constraint.subjectName,
                teacherName: constraint.teacherName,
                type: constraint.type || 'SUBJECT',
                duration,
                day,
                slotIndex: slot
              };
              const nextEntries = [...entries, candidate];
              const gaps = dayGapCount(nextEntries, day, lunchSlotIndex);
              const contiguousOk = fixedDayContiguous[day] ? gaps === 0 : true;
              return { slot, gaps, contiguousOk };
            })
            .sort((a, b) => {
              if (a.contiguousOk !== b.contiguousOk) return a.contiguousOk ? -1 : 1;
              if (a.gaps !== b.gaps) return a.gaps - b.gaps;
              return rand() < 0.5 ? -1 : 1;
            })
            .map((item) => item.slot);
          for (const slot of slotOrder) {
            const block = {
              blockId: `tb${Date.now()}_${constraint.id}_${i}_${day}_${slot}_${attempt}`,
              subjectName: constraint.subjectName,
              teacherName: constraint.teacherName,
              type: constraint.type || 'SUBJECT',
              duration,
              color: colorByLecture.get(key) || colorForLecture(constraint.subjectName, constraint.type, constraint.teacherName),
              day,
              slotIndex: slot
            };
            if (!canPlaceEntry(entries, block, day, slot, lunchSlotIndex)) continue;
            if (findTeacherConflictAcrossTimetables({
              allTimetables,
              teacherName: block.teacherName,
              day,
              slotIndex: slot,
              duration,
              excludeTimetableId
            })) continue;
            entries.push(block);
            dayLoad[day] = (dayLoad[day] || 0) + duration;
            lectureDayLoad[day] = (lectureDayLoad[day] || 0) + 1;
            placed = true;
            break;
          }
          if (placed) break;
        }
      }
    });

    if (entries.length > bestEntries.length) {
      bestEntries = entries;
      if (bestEntries.length >= requestedBlocks) break;
    }
  }

  return bestEntries;
};

export const TimetableManager = ({ user }) => {
  const [mode, setMode] = useState('CREATE');
  const [allTimetables, setAllTimetables] = useState([]);
  const [selectedClass, setSelectedClass] = useState({
    department: user.department || DEPARTMENTS[0],
    collegeYear: '1',
    semester: '1',
    division: user.division || DIVISIONS[0]
  });
  const [newConstraint, setNewConstraint] = useState({
    subjectName: '',
    teacherName: user.fullName || '',
    type: 'SUBJECT',
    frequencyPerWeek: '3'
  });
  const [constraints, setConstraints] = useState([]);
  const [lunchSlotIndex, setLunchSlotIndex] = useState('3');
  const [mineDraft, setMineDraft] = useState(null);
  const [dragItem, setDragItem] = useState(null);
  const [dragHover, setDragHover] = useState('');
  const [addedTemplate, setAddedTemplate] = useState({
    subjectName: '',
    teacherName: user.fullName || '',
    type: 'SUBJECT',
    frequencyPerWeek: '1'
  });
  const semesterOptions = useMemo(
    () => getSemestersForYear(selectedClass.collegeYear).map((v) => ({ value: v, label: v })),
    [selectedClass.collegeYear]
  );

  const selectedKey = timetableKey(selectedClass);
  const selectedTimetable = useMemo(
    () => (allTimetables || []).find((tt) => timetableKey(tt) === selectedKey),
    [allTimetables, selectedKey]
  );

  const updateCachedRows = (rows) => {
    localStorage.setItem(
      teacherTimetablesCacheKey(user.id),
      JSON.stringify({ rows: rows || [], fetchedAt: new Date().toISOString() })
    );
  };

  const replaceTimetableInStore = (updated) => {
    setAllTimetables((prev) => {
      const exists = prev.some((tt) => tt.id === updated.id);
      const next = exists ? prev.map((tt) => (tt.id === updated.id ? updated : tt)) : [...prev, updated];
      updateCachedRows(next);
      return next;
    });
  };
  const removeTimetableFromStore = (id) => {
    setAllTimetables((prev) => {
      const next = (prev || []).filter((tt) => tt.id !== id);
      updateCachedRows(next);
      return next;
    });
  };

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(teacherTimetablesCacheKey(user.id)) || '{}');
      if (Array.isArray(cached.rows)) setAllTimetables(cached.rows);
    } catch (_) {}

    const load = async () => {
      const rows = await ApiService.getTimetables();
      const next = rows || [];
      setAllTimetables(next);
      updateCachedRows(next);
    };
    load();
  }, [user.id]);

  useEffect(() => {
    if (!selectedTimetable) {
      setMineDraft(null);
      return;
    }
    setMineDraft({
      ...selectedTimetable,
      entries: cloneEntries(selectedTimetable.entries),
      deletedEntries: cloneEntries(selectedTimetable.deletedEntries),
      addedEntries: cloneEntries(selectedTimetable.addedEntries).map((entry) => ({
        ...entry,
        duration: Math.max(1, Number(entry.duration) || durationFromType(entry.type)),
        color: entry.color || colorForLecture(entry.subjectName, entry.type, entry.teacherName),
        frequencyPerWeek: Math.max(0, Number(entry.frequencyPerWeek) || 0)
      }))
    });
  }, [selectedTimetable?.id, selectedTimetable?.updatedAt]);

  useEffect(() => {
    const valid = getSemestersForYear(selectedClass.collegeYear);
    if (!valid.includes(String(selectedClass.semester))) {
      setSelectedClass((prev) => ({ ...prev, semester: valid[0] || '' }));
    }
  }, [selectedClass.collegeYear]);

  const mineGrid = useMemo(() => buildGrid(mineDraft?.entries || []), [mineDraft?.entries]);

  const mySchedule = useMemo(() => {
    const myName = normalize(user.fullName);
    const rows = [];
    (allTimetables || []).forEach((tt) => {
      (tt.entries || []).forEach((entry) => {
        if (normalize(entry.teacherName) !== myName) return;
        rows.push({
          id: `${tt.id}_${entry.blockId}`,
          department: tt.department,
          collegeYear: tt.collegeYear,
          semester: tt.semester,
          division: tt.division,
          day: entry.day,
          slotIndex: Number(entry.slotIndex),
          duration: Math.max(1, Number(entry.duration) || 1),
          subjectName: entry.subjectName,
          type: entry.type
        });
      });
    });
    return rows.sort((a, b) => {
      const dayDiff = dayIndex(a.day) - dayIndex(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.slotIndex - b.slotIndex;
    });
  }, [allTimetables, user.fullName]);
  const myScheduleGrid = useMemo(
    () => buildGrid((mySchedule || []).map((row) => ({
      blockId: row.id,
      subjectName: row.subjectName,
      teacherName: user.fullName,
      type: row.type,
      duration: row.duration,
      color: colorForLecture(row.subjectName, row.type, user.fullName),
      day: row.day,
      slotIndex: row.slotIndex
    }))),
    [mySchedule, user.fullName]
  );

  const addConstraint = () => {
    if (!newConstraint.subjectName.trim() || !newConstraint.teacherName.trim()) return;
    const next = {
      id: `tc${Date.now()}`,
      subjectName: newConstraint.subjectName.trim(),
      teacherName: newConstraint.teacherName.trim(),
      type: newConstraint.type,
      frequencyPerWeek: Math.max(1, Number(newConstraint.frequencyPerWeek) || 1),
      duration: durationFromType(newConstraint.type),
      color: colorForLecture(newConstraint.subjectName.trim(), newConstraint.type, newConstraint.teacherName.trim())
    };
    setConstraints((prev) => [...prev, next]);
    setNewConstraint((prev) => ({ ...prev, subjectName: '' }));
  };

  const createTimetable = async () => {
    if (selectedTimetable) {
      alert('Timetable already exists for this class. Open "Your Timetable" to edit it.');
      setMode('MINE');
      return;
    }
    if (constraints.length === 0) {
      alert('Add at least one subject constraint before creating timetable.');
      return;
    }
    const latestTimetables = await ApiService.getTimetables({ force: true });
    const timetableUniverse = latestTimetables || [];
    setAllTimetables(timetableUniverse);
    updateCachedRows(timetableUniverse);
    const generatedEntries = autoGenerateEntries(
      constraints,
      Number(lunchSlotIndex),
      timetableUniverse,
      '',
      { attempts: 20 }
    );
    const requestedBlocks = (constraints || []).reduce((sum, c) => sum + Math.max(1, Number(c.frequencyPerWeek) || 1), 0);
    if (generatedEntries.length < requestedBlocks) {
      alert('Some lectures could not be auto-placed due to teacher time conflicts or slot limits.');
    }
    const now = new Date().toISOString();
    const payload = {
      id: `tt${Date.now()}`,
      createdBy: user.id,
      createdByName: user.fullName,
      department: selectedClass.department,
      collegeYear: Number(selectedClass.collegeYear),
      semester: Number(selectedClass.semester),
      division: selectedClass.division,
      lunchSlotIndex: Number(lunchSlotIndex),
      constraints: constraints.map((c) => ({
        id: c.id,
        subjectName: c.subjectName,
        teacherName: c.teacherName,
        type: c.type,
        frequencyPerWeek: c.frequencyPerWeek
      })),
      entries: generatedEntries,
      deletedEntries: [],
      addedEntries: constraints.map((c) => ({
        blockId: `pool_${c.id}`,
        subjectName: c.subjectName,
        teacherName: c.teacherName,
        type: c.type,
        frequencyPerWeek: c.frequencyPerWeek,
        duration: c.duration,
        color: c.color
      })),
      createdAt: now,
      updatedAt: now
    };
    try {
      const created = await ApiService.addTimetable(payload);
      replaceTimetableInStore(created || payload);
      setMode('MINE');
    } catch (err) {
      const detail = err?.data?.conflicts?.[0];
      if (detail) {
        const c = detail.conflictWith || {};
        alert(
          `Teacher conflict: ${detail.teacherName} already has a lecture on ${detail.day} at slot ${Number(c.slotIndex) + 1} (Div ${c.division || '-'}, Y${c.collegeYear || '-'} S${c.semester || '-'}).`
        );
        return;
      }
      alert(err?.data?.error || err?.message || 'Unable to create timetable.');
    }
  };

  const onDropToCell = (day, slotIndex) => {
    if (!mineDraft || !dragItem) return;
    const lunch = Number(mineDraft.lunchSlotIndex);
    const conflictMessage = (teacherName, conflict) => (
      `Cannot place this lecture. ${teacherName} already has ${conflict.subjectName || 'a lecture'} on ${day} at slot ${conflict.slotIndex + 1} in ${conflict.department || '-'} Div ${conflict.division || '-'} (Y${conflict.collegeYear || '-'} S${conflict.semester || '-'}).`
    );
    if (slotIndex === lunch) {
      setDragHover('');
      return;
    }
    if (dragItem.kind === 'existing') {
      const moving = dragItem.entry;
      const extConflict = findTeacherConflictAcrossTimetables({
        allTimetables,
        teacherName: moving.teacherName,
        day,
        slotIndex,
        duration: moving.duration,
        excludeTimetableId: mineDraft.id
      });
      if (extConflict) {
        alert(conflictMessage(moving.teacherName, extConflict));
        setDragHover('');
        return;
      }
      if (!canPlaceEntry(mineDraft.entries, moving, day, slotIndex, lunch, moving.blockId)) return;
      setMineDraft((prev) => ({
        ...prev,
        entries: (prev.entries || []).map((entry) => (
          entry.blockId === moving.blockId ? { ...entry, day, slotIndex } : entry
        ))
      }));
    } else if (dragItem.kind === 'deleted') {
      const source = dragItem.entry;
      const restored = { ...source, blockId: `tb${Date.now()}`, day, slotIndex };
      const extConflict = findTeacherConflictAcrossTimetables({
        allTimetables,
        teacherName: restored.teacherName,
        day,
        slotIndex,
        duration: restored.duration,
        excludeTimetableId: mineDraft.id
      });
      if (extConflict) {
        alert(conflictMessage(restored.teacherName, extConflict));
        setDragHover('');
        return;
      }
      if (!canPlaceEntry(mineDraft.entries, restored, day, slotIndex, lunch)) return;
      setMineDraft((prev) => ({
        ...prev,
        entries: [...(prev.entries || []), restored],
        deletedEntries: (prev.deletedEntries || []).filter((entry) => entry.blockId !== source.blockId)
      }));
    } else if (dragItem.kind === 'added') {
      const template = dragItem.entry;
      const remaining = Math.max(0, Number(template.frequencyPerWeek) || 0);
      if (remaining <= 0) return;
      const created = {
        blockId: `tb${Date.now()}`,
        subjectName: template.subjectName,
        teacherName: template.teacherName,
        type: template.type || 'SUBJECT',
        duration: durationFromType(template.type),
        color: template.color || colorForLecture(template.subjectName, template.type, template.teacherName),
        day,
        slotIndex
      };
      const extConflict = findTeacherConflictAcrossTimetables({
        allTimetables,
        teacherName: created.teacherName,
        day,
        slotIndex,
        duration: created.duration,
        excludeTimetableId: mineDraft.id
      });
      if (extConflict) {
        alert(conflictMessage(created.teacherName, extConflict));
        setDragHover('');
        return;
      }
      if (!canPlaceEntry(mineDraft.entries, created, day, slotIndex, lunch)) return;
      setMineDraft((prev) => ({
        ...prev,
        entries: [...(prev.entries || []), created],
        addedEntries: (prev.addedEntries || [])
          .map((entry) => (
            entry.blockId === template.blockId
              ? { ...entry, frequencyPerWeek: Math.max(0, Number(entry.frequencyPerWeek) - 1) }
              : entry
          ))
          .filter((entry) => Number(entry.frequencyPerWeek) > 0)
      }));
    }
    setDragHover('');
  };

  const deleteBlock = (blockId) => {
    setMineDraft((prev) => {
      const target = (prev.entries || []).find((entry) => entry.blockId === blockId);
      if (!target) return prev;
      const { day, slotIndex, ...rest } = target;
      return {
        ...prev,
        entries: (prev.entries || []).filter((entry) => entry.blockId !== blockId),
        deletedEntries: [...(prev.deletedEntries || []), rest]
      };
    });
  };

  const addTemplate = () => {
    if (!addedTemplate.subjectName.trim() || !addedTemplate.teacherName.trim()) return;
    const next = {
      blockId: `extra_${Date.now()}`,
      subjectName: addedTemplate.subjectName.trim(),
      teacherName: addedTemplate.teacherName.trim(),
      type: addedTemplate.type,
      frequencyPerWeek: Math.max(1, Number(addedTemplate.frequencyPerWeek) || 1),
      duration: durationFromType(addedTemplate.type),
      color: colorForLecture(addedTemplate.subjectName.trim(), addedTemplate.type, addedTemplate.teacherName.trim())
    };
    setMineDraft((prev) => ({ ...prev, addedEntries: [...(prev?.addedEntries || []), next] }));
    setAddedTemplate((prev) => ({ ...prev, subjectName: '' }));
  };
  const deleteAddedTemplate = (blockId) => {
    setMineDraft((prev) => ({
      ...prev,
      addedEntries: (prev?.addedEntries || []).filter((entry) => entry.blockId !== blockId)
    }));
  };

  const saveMine = async () => {
    if (!mineDraft) return;
    const payload = { ...mineDraft, updatedAt: new Date().toISOString() };
    try {
      const updated = await ApiService.updateTimetable(mineDraft.id, payload);
      replaceTimetableInStore(updated || payload);
      alert('Timetable saved.');
    } catch (err) {
      const detail = err?.data?.conflicts?.[0];
      if (detail) {
        const c = detail.conflictWith || {};
        alert(
          `Teacher conflict: ${detail.teacherName} already has a lecture on ${detail.day} at slot ${Number(c.slotIndex) + 1} (Div ${c.division || '-'}, Y${c.collegeYear || '-'} S${c.semester || '-'}).`
        );
        return;
      }
      alert(err?.data?.error || err?.message || 'Unable to save timetable.');
    }
  };

  const deleteSelectedTimetable = async () => {
    const targetId = mineDraft?.id || selectedTimetable?.id;
    if (!targetId) return;
    if (!window.confirm('Delete timetable for the selected class?')) return;
    try {
      await ApiService.deleteTimetable(targetId);
      removeTimetableFromStore(targetId);
      setMineDraft(null);
      alert('Timetable deleted.');
    } catch (err) {
      alert(err?.data?.error || err?.message || 'Unable to delete timetable.');
    }
  };

  const regenerateMine = async () => {
    if (!mineDraft) return;
    const latestTimetables = await ApiService.getTimetables({ force: true });
    const timetableUniverse = latestTimetables || [];
    setAllTimetables(timetableUniverse);
    updateCachedRows(timetableUniverse);
    const poolConstraints = (mineDraft.addedEntries || []).map((entry) => ({
      id: entry.id || entry.blockId || `pool_${Date.now()}`,
      subjectName: entry.subjectName,
      teacherName: entry.teacherName,
      type: entry.type || 'SUBJECT',
      frequencyPerWeek: Math.max(1, Number(entry.frequencyPerWeek) || 1),
      duration: Math.max(1, Number(entry.duration) || durationFromType(entry.type)),
      color: entry.color || colorForLecture(entry.subjectName, entry.type, entry.teacherName)
    }));
    const combinedConstraints = [...(mineDraft.constraints || []), ...poolConstraints];
    const constraintKeys = new Set(
      combinedConstraints.map((c) => lectureKey(c.subjectName, c.type, c.teacherName))
    );
    const fixedEntries = (mineDraft.entries || []).filter(
      (entry) => !constraintKeys.has(lectureKey(entry.subjectName, entry.type, entry.teacherName))
    );
    const nextEntries = autoGenerateEntries(
      combinedConstraints,
      Number(mineDraft.lunchSlotIndex),
      timetableUniverse,
      mineDraft.id,
      { attempts: 20, fixedEntries }
    );
    const requestedBlocks = combinedConstraints.reduce((sum, c) => sum + Math.max(1, Number(c.frequencyPerWeek) || 1), 0);
    if ((nextEntries.length - fixedEntries.length) < requestedBlocks) {
      alert('Some lectures could not be auto-placed due to teacher time conflicts or slot limits.');
    }
    setMineDraft((prev) => ({ ...prev, entries: nextEntries, deletedEntries: [] }));
  };

  const permanentlyDeleteRemoved = (blockId) => {
    setMineDraft((prev) => ({
      ...prev,
      deletedEntries: (prev.deletedEntries || []).filter((entry) => entry.blockId !== blockId)
    }));
  };

  const classSelectors = (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 timetable-create-form">
      <Select label="Department" options={DEPARTMENTS.map((d) => ({ value: d, label: d }))} value={selectedClass.department} onChange={(e) => setSelectedClass((prev) => ({ ...prev, department: e.target.value }))} />
      <Select label="Year" options={YEARS.map((v) => ({ value: v, label: v }))} value={selectedClass.collegeYear} onChange={(e) => setSelectedClass((prev) => ({ ...prev, collegeYear: e.target.value }))} />
      <Select label="Semester" options={semesterOptions} value={selectedClass.semester} onChange={(e) => setSelectedClass((prev) => ({ ...prev, semester: e.target.value }))} />
      <Select label="Division" options={DIVISIONS.map((d) => ({ value: d, label: d }))} value={selectedClass.division} onChange={(e) => setSelectedClass((prev) => ({ ...prev, division: e.target.value }))} />
    </div>
  );

  return (
    <Card title="Timetable Manager">
      <div className="flex border-b mb-4 overflow-x-auto">
        {[
          { id: 'CREATE', label: 'Create Timetable' },
          { id: 'MINE', label: 'Your Timetable' },
          { id: 'MYSCHEDULE', label: 'My Schedule' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex-1 py-2 px-4 text-sm font-semibold ${mode === tab.id ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-600'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {mode === 'CREATE' && (
        <div className="space-y-4">
          {classSelectors}
          <div className="max-w-xs">
            <Select
              label="Lunch Break Slot"
              options={TIMETABLE_SLOTS.map((s, i) => ({ value: String(i), label: `${i + 1}. ${s}` }))}
              value={lunchSlotIndex}
              onChange={(e) => setLunchSlotIndex(e.target.value)}
            />
          </div>
          {selectedTimetable && (
            <div className="p-3 rounded bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm">
              A timetable already exists for this class. Use "Your Timetable" to edit.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 timetable-create-form">
            <Input label="Subject Name" value={newConstraint.subjectName} onChange={(e) => setNewConstraint((prev) => ({ ...prev, subjectName: e.target.value }))} />
            <Input label="Teacher Name" value={newConstraint.teacherName} onChange={(e) => setNewConstraint((prev) => ({ ...prev, teacherName: e.target.value }))} />
            <Select label="Type" options={[{ value: 'SUBJECT', label: 'SUBJECT' }, { value: 'LAB', label: 'LAB' }]} value={newConstraint.type} onChange={(e) => setNewConstraint((prev) => ({ ...prev, type: e.target.value }))} />
            <Input type="number" min="1" max="10" label="Freq / Week" value={newConstraint.frequencyPerWeek} onChange={(e) => setNewConstraint((prev) => ({ ...prev, frequencyPerWeek: e.target.value }))} />
          </div>
          <div className="timetable-create-action">
            <Button variant="secondary" className="text-black" onClick={addConstraint}>Add Subject Constraint</Button>
          </div>

          <div className="space-y-2">
            {constraints.map((c) => (
              <div key={c.id} className="p-3 border rounded bg-white text-black flex items-center justify-between">
                <div>
                  <div className="font-semibold">{c.subjectName}</div>
                  <div className="text-xs text-gray-600">{c.teacherName} | {c.type} | {c.frequencyPerWeek}/week | {c.type === 'LAB' ? '2hr' : '1hr'}</div>
                </div>
                <button className="text-red-600" onClick={() => setConstraints((prev) => prev.filter((x) => x.id !== c.id))}><Trash2 size={14} /></button>
              </div>
            ))}
            {constraints.length === 0 && <div className="text-sm text-gray-500">No constraints added yet.</div>}
          </div>

          <Button onClick={createTimetable} disabled={!!selectedTimetable}>Create + Auto Generate Timetable</Button>
        </div>
      )}

      {mode === 'MINE' && (
        <div className="space-y-4">
          {classSelectors}
          {!mineDraft ? (
            <div className="text-sm text-gray-500">No timetable found for selected class.</div>
          ) : (
            <>
              <div className="flex gap-2">
                <Button variant="secondary" className="text-black" onClick={regenerateMine}>Regenerate Timetable</Button>
                <Button variant="danger" onClick={deleteSelectedTimetable}>Delete Selected Timetable</Button>
              </div>
              <div className="text-sm text-gray-700 font-semibold">
                Timetable of: {mineDraft.department} | Y{mineDraft.collegeYear} S{mineDraft.semester} | Div {mineDraft.division}
              </div>
              <div className="table-wrapper timetable-table-wrap">
                <table className="w-full timetable-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      {TIMETABLE_DAYS.map((day) => <th key={day}>{day}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {TIMETABLE_SLOTS.map((slot, slotIndex) => (
                      <tr key={slot}>
                        <td className="time-col">{slot}</td>
                        {TIMETABLE_DAYS.map((day) => {
                          const key = slotKey(day, slotIndex);
                          const cell = mineGrid[key];
                          const isLunch = slotIndex === Number(mineDraft.lunchSlotIndex);
                          return (
                            <td
                              key={`${day}_${slotIndex}`}
                              className={`timetable-cell ${dragHover === key ? 'drag-hover' : ''} ${isLunch ? 'tt-lunch-cell' : ''}`}
                              onDragOver={(e) => {
                                if (isLunch) return;
                                if (!dragItem) {
                                  e.preventDefault();
                                  setDragHover(key);
                                  return;
                                }
                                const source = dragItem.entry || {};
                                const duration = dragItem.kind === 'added'
                                  ? durationFromType(source.type)
                                  : Math.max(1, Number(source.duration) || 1);
                                const extConflict = findTeacherConflictAcrossTimetables({
                                  allTimetables,
                                  teacherName: source.teacherName,
                                  day,
                                  slotIndex,
                                  duration,
                                  excludeTimetableId: mineDraft.id
                                });
                                if (extConflict) {
                                  setDragHover('');
                                  return;
                                }
                                e.preventDefault();
                                setDragHover(key);
                              }}
                              onDragLeave={() => setDragHover('')}
                              onDrop={(e) => {
                                e.preventDefault();
                                onDropToCell(day, slotIndex);
                              }}
                            >
                              {isLunch ? (
                                <div className="tt-lunch-label">Lunch Break</div>
                              ) : cell && cell.isHead ? (
                                <div
                                  className="tt-block tt-draggable"
                                  style={{ backgroundColor: cell.color || '#dbeafe' }}
                                  draggable
                                  onDragStart={() => setDragItem({ kind: 'existing', entry: cell })}
                                  onDragEnd={() => { setDragItem(null); setDragHover(''); }}
                                >
                                  <button className="tt-delete-btn" onClick={() => deleteBlock(cell.blockId)}>x</button>
                                  <div className="tt-title">{cell.subjectName}</div>
                                  <div className="tt-meta">{cell.teacherName} | {cell.type}</div>
                                </div>
                              ) : cell ? (
                                <div className="tt-block" style={{ backgroundColor: cell.color || '#dbeafe' }}>
                                  <div className="tt-title">{cell.subjectName} (cont.)</div>
                                  <div className="tt-meta">{cell.teacherName} | {cell.type}</div>
                                </div>
                              ) : (
                                <span className="tt-empty">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="font-semibold text-black mb-2">Removed Blocks (Drag to restore)</div>
                  <div className="space-y-2">
                    {(mineDraft.deletedEntries || []).map((entry, i) => (
                      <div
                        key={`${entry.blockId}_${i}`}
                        className="tt-deleted-card text-black"
                        draggable
                        onDragStart={() => setDragItem({ kind: 'deleted', entry })}
                        onDragEnd={() => { setDragItem(null); setDragHover(''); }}
                      >
                        <div className="font-semibold flex items-center justify-between">
                          <span>{entry.subjectName}</span>
                          <button className="text-red-600 text-xs underline" onClick={() => permanentlyDeleteRemoved(entry.blockId)}>
                            Delete
                          </button>
                        </div>
                        <div className="text-xs text-gray-600">{entry.teacherName} | {entry.type} | {entry.duration || 1} slot(s)</div>
                      </div>
                    ))}
                    {(mineDraft.deletedEntries || []).length === 0 && <div className="text-sm text-gray-500">No removed blocks.</div>}
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-black mb-2">Add Lecture (Drag to schedule)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 tt-added-subject-col mb-2">
                    <Input label="Subject" value={addedTemplate.subjectName} onChange={(e) => setAddedTemplate((prev) => ({ ...prev, subjectName: e.target.value }))} />
                    <Input label="Teacher" value={addedTemplate.teacherName} onChange={(e) => setAddedTemplate((prev) => ({ ...prev, teacherName: e.target.value }))} />
                    <Select label="Type" options={[{ value: 'SUBJECT', label: 'SUBJECT' }, { value: 'LAB', label: 'LAB' }]} value={addedTemplate.type} onChange={(e) => setAddedTemplate((prev) => ({ ...prev, type: e.target.value }))} />
                    <Input type="number" min="1" max="10" label="Freq / Week" value={addedTemplate.frequencyPerWeek} onChange={(e) => setAddedTemplate((prev) => ({ ...prev, frequencyPerWeek: e.target.value }))} />
                  </div>
                  <Button variant="secondary" className="text-black mb-2" onClick={addTemplate}>Add</Button>
                  <div className="space-y-2">
                    {(mineDraft.addedEntries || []).map((entry, i) => (
                      <div
                        key={`${entry.blockId}_${i}`}
                        className="tt-deleted-card text-black"
                        draggable
                        onDragStart={() => setDragItem({ kind: 'added', entry })}
                        onDragEnd={() => { setDragItem(null); setDragHover(''); }}
                      >
                        <div className="font-semibold flex items-center justify-between gap-2">
                          <span>{entry.subjectName}</span>
                          <button className="text-red-600 text-xs underline" onClick={() => deleteAddedTemplate(entry.blockId)}>
                            Delete
                          </button>
                        </div>
                        <div className="text-xs text-gray-600">{entry.teacherName} | {entry.type} | remaining: {entry.frequencyPerWeek}</div>
                      </div>
                    ))}
                    {(mineDraft.addedEntries || []).length === 0 && <div className="text-sm text-gray-500">No added templates.</div>}
                  </div>
                </div>
              </div>

              <Button onClick={saveMine}>Save Timetable</Button>
            </>
          )}
        </div>
      )}

      {mode === 'MYSCHEDULE' && (
        <div>
          <div className="mb-3 text-sm text-black font-semibold">My lecture timetable</div>
          <div className="table-wrapper timetable-table-wrap">
            <table className="w-full timetable-table">
              <thead>
                <tr>
                  <th>Time</th>
                  {TIMETABLE_DAYS.map((day) => <th key={day}>{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {TIMETABLE_SLOTS.map((slot, slotIndex) => (
                  <tr key={slot}>
                    <td className="time-col">{slot}</td>
                    {TIMETABLE_DAYS.map((day) => {
                      const cell = myScheduleGrid[slotKey(day, slotIndex)];
                      return (
                        <td key={`${day}_${slotIndex}`} className="timetable-cell">
                          {!cell ? (
                            <span className="tt-empty">-</span>
                          ) : (
                            <div className="tt-block" style={{ backgroundColor: cell.color || '#dbeafe' }}>
                              <div className="tt-title">{cell.subjectName}{cell.isContinuation ? ' (cont.)' : ''}</div>
                              {!cell.isContinuation && (() => {
                                const row = mySchedule.find((x) => x.id === cell.blockId);
                                return (
                                  <div className="tt-meta">
                                    {row ? `${row.department} | Y${row.collegeYear} S${row.semester} Div ${row.division}` : cell.type}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {mySchedule.length === 0 && (
            <div className="text-sm text-gray-500 mt-3">No lectures mapped to your name yet.</div>
          )}
        </div>
      )}
    </Card>
  );
};

const ClassroomGroupsManager = ({ user }) => {
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [mode, setMode] = useState('GROUPS');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinKey, setJoinKey] = useState('');

  const load = async () => {
    const all = await ApiService.getClassroomGroups();
    setGroups((all || []).filter((g) => g.teacherId === user.id || (g.studentIds || []).includes(user.id)));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (mode !== 'CHAT' || !selected?.id) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      const fresh = await ApiService.getClassroomGroupMessages(selected.id);
      setMsgs(fresh || []);
      const c = groupChatCacheKey(selected.id);
      const s = groupChatSyncKey(selected.id);
      localStorage.setItem(c, JSON.stringify(fresh || []));
      if ((fresh || []).length) localStorage.setItem(s, fresh[fresh.length - 1].timestamp);
      else localStorage.removeItem(s);
    }, 4000);
    return () => clearInterval(t);
  }, [mode, selected?.id]);

  const open = async (g) => {
    setSelected(g);
    setMode('CHAT');
    const c = groupChatCacheKey(g.id);
    const s = groupChatSyncKey(g.id);
    try {
      const cached = JSON.parse(localStorage.getItem(c) || '[]');
      if (Array.isArray(cached)) setMsgs(cached);
    } catch (_) {}
    const fresh = await ApiService.getClassroomGroupMessages(g.id);
    setMsgs(() => {
      const n = fresh || [];
      localStorage.setItem(c, JSON.stringify(n));
      if (n.length) localStorage.setItem(s, n[n.length - 1].timestamp);
      else localStorage.removeItem(s);
      return n;
    });
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    const key = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ApiService.addClassroomGroup({
      id: `cg${Date.now()}`,
      name: newGroupName.trim(),
      joinKey: key,
      teacherId: user.id,
      teacherName: user.fullName,
      studentIds: [],
      messages: []
    });
    setNewGroupName('');
    await load();
    alert(`Group Created! Key: ${key}`);
    setMode('KEYS');
  };

  const joinGroup = async () => {
    const all = await ApiService.getClassroomGroups();
    const group = (all || []).find((g) => g.joinKey === joinKey.toUpperCase());
    if (!group) return alert('Invalid Key');
    if (group.teacherId === user.id) return alert('You created this group.');
    if ((group.studentIds || []).includes(user.id)) return alert('Already joined.');
    await ApiService.updateClassroomGroup(group.id, {
      ...group,
      studentIds: [...(group.studentIds || []), user.id]
    });
    alert('Joined Group!');
    setJoinKey('');
    await load();
    setMode('GROUPS');
  };

  const deleteGroup = async (g) => {
    if (!window.confirm('Delete group? This will remove it for all members.')) return;
    await ApiService.deleteClassroomGroup(g.id);
    await load();
    if (selected?.id === g.id) setSelected(null);
    setMode('GROUPS');
  };

  const send = async () => {
    if (!selected || !message.trim()) return;
    const m = {
      id: `cm${Date.now()}`,
      senderId: user.id,
      senderName: user.fullName,
      role: 'TEACHER',
      message: message.trim(),
      timestamp: new Date().toISOString()
    };
    await ApiService.addClassroomGroupMessage(selected.id, m);
    setMsgs((p) => merge(p, [m]));
    setMessage('');
  };

  const deleteMessage = async (messageId) => {
    if (!selected?.id) return;
    await ApiService.deleteClassroomGroupMessage(selected.id, messageId, user.id);
    const c = groupChatCacheKey(selected.id);
    const s = groupChatSyncKey(selected.id);
    setMsgs((prev) => {
      const next = prev.filter((m) => m.id !== messageId);
      localStorage.setItem(c, JSON.stringify(next));
      if (next.length) {
        localStorage.setItem(s, next[next.length - 1].timestamp);
      } else {
        localStorage.removeItem(s);
      }
      return next;
    });
  };

  return (
    <Card title="Classroom Groups">
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <Button variant={mode === 'GROUPS' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('GROUPS')}>My Groups</Button>
        <Button variant={mode === 'CREATE' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('CREATE')}>Create</Button>
        <Button variant={mode === 'KEYS' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('KEYS')}>Group Keys</Button>
        <Button variant={mode === 'JOIN' ? 'primary' : 'outline'} size="sm" onClick={() => setMode('JOIN')}>Join Group</Button>
      </div>

      {mode === 'GROUPS' && (
        <div className="grid gap-3">
          {groups.map((g) => (
            <div key={g.id} className="p-3 border rounded bg-white hover:shadow-md cursor-pointer flex justify-between items-center" onClick={() => open(g)}>
              <div>
                <div className="font-bold text-black">{g.name}</div>
                <div className="text-xs text-gray-500">{g.teacherId === user.id ? 'Created by Me' : `Teacher: ${g.teacherName}`}</div>
              </div>
              <div className="flex items-center gap-2">
                {g.teacherId === user.id && (
                  <button onClick={(e) => { e.stopPropagation(); deleteGroup(g); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16} /></button>
                )}
                <Send size={16} className="text-indigo-600" />
              </div>
            </div>
          ))}
          {groups.length === 0 && <p className="text-gray-400 text-center py-4">No groups yet.</p>}
        </div>
      )}

      {mode === 'CREATE' && (
        <div className="max-w-sm mx-auto py-4 space-y-3">
          <Input label="Group Name" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
          <Button onClick={createGroup} className="w-full">Generate Key & Create</Button>
        </div>
      )}

      {mode === 'KEYS' && (
        <div className="space-y-2">
          {groups.filter((g) => g.teacherId === user.id).map((g) => (
            <div key={g.id} className="p-3 bg-indigo-50 border border-indigo-100 rounded flex justify-between">
              <span className="font-semibold text-black">{g.name}</span>
              <span className="font-mono bg-white px-2 rounded border text-black">{g.joinKey}</span>
            </div>
          ))}
          {groups.filter((g) => g.teacherId === user.id).length === 0 && <p className="text-center text-gray-400">You haven't created any groups.</p>}
        </div>
      )}

      {mode === 'JOIN' && (
        <div className="max-w-sm mx-auto py-4 space-y-3">
          <Input label="Enter Group Key" value={joinKey} onChange={(e) => setJoinKey(e.target.value)} />
          <Button onClick={joinGroup} className="w-full">Join Group</Button>
        </div>
      )}

      {mode === 'CHAT' && selected && (
        <div className="h-[500px] flex flex-col">
          <div className="border-b pb-2 mb-2 flex justify-between items-center">
            <h3 className="font-bold text-black">{selected.name}</h3>
            <Button size="sm" variant="outline" onClick={() => setMode('GROUPS')}>Back</Button>
          </div>
          <div className="h-[420px] overflow-y-auto bg-gray-50 p-4 rounded mb-4 space-y-3 chat-scroll-mini group-chat-scrollbar">
            {msgs.map((m) => (
              <div key={m.id || m.timestamp} className={`p-2 rounded max-w-[80%] group text-black ${m.senderId === user.id ? 'ml-auto bg-indigo-100' : 'bg-white border'}`}>
                <div className="flex justify-between items-baseline gap-2">
                  <span className="font-bold text-xs text-black">{m.senderName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-black/60">{new Date(m.timestamp).toLocaleTimeString()}</span>
                    {m.senderId === user.id && (
                      <button onClick={() => deleteMessage(m.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                {m.message && <p className="text-sm text-black">{m.message}</p>}
              </div>
            ))}
            {msgs.length === 0 && <div className="text-center text-gray-500 py-4">No messages yet.</div>}
          </div>
          <div className="flex gap-2 mt-2">
            <Input value={message} onChange={(e) => setMessage(e.target.value)} className="mb-0 flex-1" placeholder="Message..." />
            <Button onClick={send}><Send size={16} /></Button>
          </div>
        </div>
      )}
    </Card>
  );
};

const GuideTab = ({ user }) => {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [scoreMap, setScoreMap] = useState({});
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [groupChats, setGroupChats] = useState([]);
  const [groupChatMessage, setGroupChatMessage] = useState('');

  const load = async () => {
    const [assignments, projects, groups, submissions, marks, ideas] = await Promise.all([
      ApiService.getAssignments(),
      ApiService.getProjects(),
      ApiService.getGroups(),
      ApiService.getSubmissions(),
      ApiService.getMarks(),
      ApiService.getProjectIdeas()
    ]);
    const myProjectIds = (projects || []).filter((p) => p.guideId === user.id).map((p) => p.id);
    const items = (assignments || [])
      .filter((a) => myProjectIds.includes(a.projectId))
      .map((a) => {
        const project = (projects || []).find((p) => p.id === a.projectId) || null;
        const group = (groups || []).find((g) => g.id === a.groupId) || null;
        const submission = (submissions || []).find((s) => s.assignmentId === a.id) || null;
        const mark = (marks || []).find((m) => m.groupId === a.groupId && m.projectId === a.projectId) || null;
        const idea = (ideas || []).find((i) => i.assignmentId === a.id) || null;
        return { assignment: a, project, group, submission, mark, idea };
      });
    setRows(items);
    if (!selectedId && items.length) setSelectedId(items[0].assignment.id);
  };

  useEffect(() => { load(); }, [user.id]);

  const selected = rows.find((x) => x.assignment.id === selectedId) || null;
  const selectedGroupId = selected?.assignment?.groupId || '';
  const updateIdeaStatus = async (nextStatus) => {
    if (!selected?.idea) return;
    const payload = {
      ...selected.idea,
      status: nextStatus,
      reviewedBy: user.id,
      reviewedByName: user.fullName,
      reviewedAt: new Date().toISOString()
    };
    await ApiService.updateProjectIdea(selected.idea.id, payload);
    await load();
  };

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupChats([]);
      return;
    }
    const sync = async () => {
      const chats = await ApiService.getChats({ targetId: selectedGroupId, targetType: 'GROUP' });
      setGroupChats((chats || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
    };
    sync();
    const interval = setInterval(sync, 6000);
    return () => clearInterval(interval);
  }, [selectedGroupId]);

  useEffect(() => {
    if (!selected) return;
    const rubrics = selected.project?.rubrics || [];
    const existing = selected.mark?.rubricScores || [];
    const next = {};
    rubrics.forEach((r) => {
      const found = existing.find((e) => e.title === r.title);
      next[r.title] = Number(found?.obtainedMarks ?? 0);
    });
    setScoreMap(next);
    setRemarks(selected.mark?.rubrics || '');
  }, [selectedId, selected?.mark?.id]);

  const totalMarks = selected?.project?.totalMarks || 0;
  const rubricList = selected?.project?.rubrics || [];
  const totalObtained = rubricList.reduce((sum, r) => sum + (Number(scoreMap[r.title]) || 0), 0);

  const saveMarks = async (submitToAdmin) => {
    if (!selected) return;
    if (!selected.submission) {
      alert('Marks can be assigned only after student submission.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: selected.mark?.id || `mk${Date.now()}`,
        groupId: selected.assignment.groupId,
        projectId: selected.assignment.projectId,
        teacherMarks: totalObtained,
        isSubmittedToAdmin: !!submitToAdmin,
        adminMarks: selected.mark?.adminMarks || 0,
        projectLink: selected.submission?.link || '',
        rubrics: remarks || '',
        rubricScores: rubricList.map((r) => ({
          title: r.title,
          maxMarks: Number(r.maxMarks) || 0,
          obtainedMarks: Math.max(0, Math.min(Number(r.maxMarks) || 0, Number(scoreMap[r.title]) || 0))
        })),
        progress: Number(selected.assignment.progress || 0)
      };
      await ApiService.saveMark(payload);
      if (submitToAdmin) {
        await ApiService.updateAssignment(selected.assignment.id, { ...selected.assignment, status: 'GRADED' });
      }
      await load();
      alert(submitToAdmin ? 'Marks submitted to admin.' : 'Marks saved.');
    } finally {
      setSaving(false);
    }
  };

  const sendGroupChat = async () => {
    const text = groupChatMessage.trim();
    if (!selectedGroupId || !text) return;
    const payload = {
      id: `c${Date.now()}`,
      senderId: user.id,
      senderName: user.fullName,
      targetId: selectedGroupId,
      targetType: 'GROUP',
      message: text,
      timestamp: new Date().toISOString()
    };
    await ApiService.addChat(payload);
    setGroupChats((prev) => merge(prev, [payload]));
    setGroupChatMessage('');
  };

  const deleteGroupChat = async (chatId) => {
    await ApiService.deleteChat(chatId);
    setGroupChats((prev) => prev.filter((item) => item.id !== chatId));
  };

  return (
    <div className="guide-tab grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card title="Assigned Groups">
        <div className="space-y-2 max-h-[560px] overflow-y-auto">
          {rows.map((r) => {
            const isSelected = r.assignment.id === selectedId;
            return (
              <button
                key={r.assignment.id}
                onClick={() => setSelectedId(r.assignment.id)}
                className={`w-full text-left p-3 rounded border ${isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="font-semibold text-black">{r.project?.title || 'Untitled Project'}</div>
                <div className="text-sm text-gray-700">Leader: {r.group?.groupLeader || '-'}</div>
                <div className="text-xs text-gray-500">Group {r.group?.groupNo ?? '-'} | {r.group?.department || '-'} | Div {r.group?.division || '-'} | Sem {r.group?.semester || '-'}</div>
                <div className="text-xs mt-1">
                  <span className={`px-2 py-0.5 rounded ${r.submission ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                    {r.submission ? 'Submitted' : 'Not Submitted'}
                  </span>
                </div>
              </button>
            );
          })}
          {rows.length === 0 && <div className="text-gray-500 text-center py-6">No groups assigned yet.</div>}
        </div>
      </Card>

      <div className="lg:col-span-2">
        {!selected ? (
          <Card><div className="text-gray-500 text-center py-10">Select an assigned group.</div></Card>
        ) : (
          <Card title="Group Details">
            <div className="space-y-4">
              <div className="p-3 rounded border bg-white">
                <div className="font-semibold text-black">{selected.project?.title || '-'}</div>
                <div className="text-sm text-gray-700">Group No: {selected.group?.groupNo ?? '-'}</div>
                <div className="text-sm text-gray-700">Leader: {selected.group?.groupLeader || '-'}</div>
                <div className="text-sm text-gray-700">Status: {selected.assignment.status || 'ASSIGNED'}</div>
                <div className="text-sm text-gray-700">Progress: {selected.assignment.progress || 0}%</div>
              </div>

              <div className="p-3 rounded border bg-white">
                <div className="font-semibold text-black mb-2">Submission</div>
                {selected.submission ? (
                  <div className="space-y-1 text-sm text-black">
                    <div>Topic: {selected.submission.topicName || '-'}</div>
                    <div>Submitted: {new Date(selected.submission.submissionDate).toLocaleString()}</div>
                    <div>File: {selected.submission.fileName || '-'}</div>
                    <div>
                      Link: {selected.submission.link ? (
                        <a href={selected.submission.link} target="_blank" rel="noreferrer" className="text-indigo-700 underline break-all">{selected.submission.link}</a>
                      ) : '-'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-yellow-700">Student has not submitted yet.</div>
                )}
              </div>

              <div className="p-3 rounded border bg-white">
                <div className="font-semibold text-black mb-2">Project Idea</div>
                {selected.idea ? (
                  <div className="space-y-2 text-sm text-black">
                    <div>Idea: {selected.idea.ideaTitle || '-'}</div>
                    <div>Status: <span className="font-semibold">{selected.idea.status || 'PENDING'}</span></div>
                    <div>Submitted: {selected.idea.submittedAt ? new Date(selected.idea.submittedAt).toLocaleString() : '-'}</div>
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="secondary" className="text-black" onClick={() => updateIdeaStatus('APPROVED')}>Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => updateIdeaStatus('CHANGES_REQUESTED')}>Request Changes</Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-600">No idea submitted yet.</div>
                )}
              </div>

              <div className="p-3 rounded border bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-black">Rubric Marks</div>
                  <div className="text-sm text-indigo-700 font-semibold">{totalObtained} / {totalMarks}</div>
                </div>
                {rubricList.length > 0 ? (
                  <div className="space-y-2">
                    {rubricList.map((r, idx) => (
                      <div key={`${r.title}_${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center border rounded p-2">
                        <div className="md:col-span-6 text-sm font-medium text-black">{r.title}</div>
                        <div className="md:col-span-3 text-xs text-gray-500">Max: {r.maxMarks}</div>
                        <div className="md:col-span-3">
                          <input
                            type="number"
                            min="0"
                            max={Number(r.maxMarks) || 0}
                            className="ui-input mb-0"
                            value={String(scoreMap[r.title] ?? 0)}
                            disabled={!selected.submission}
                            onChange={(e) => setScoreMap((prev) => ({ ...prev, [r.title]: e.target.value }))}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-red-700">No rubrics configured for this project.</div>
                )}

                <div className="mt-3">
                  <label className="ui-label">Teacher Remarks</label>
                  <textarea
                    className="ui-input min-h-[90px]"
                    value={remarks}
                    disabled={!selected.submission}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Add remarks..."
                  />
                </div>

                <div className="flex gap-2 mt-3">
                  <Button variant="secondary" className="text-black" disabled={saving || !selected.submission} onClick={() => saveMarks(false)}>
                    Save Marks
                  </Button>
                  <Button disabled={saving || !selected.submission} onClick={() => saveMarks(true)}>
                    Submit To Admin
                  </Button>
                </div>
                {selected.mark?.isSubmittedToAdmin && (
                  <div className="text-sm text-green-700 mt-2">Already submitted to admin.</div>
                )}
              </div>

              <div className="p-3 rounded border bg-white">
                <div className="font-semibold text-black mb-2">Group Chat</div>
                <div className="space-y-2 h-[240px] overflow-y-auto rounded border p-2 bg-gray-50 chat-scroll-mini">
                  {groupChats.map((m) => (
                    <div
                      key={m.id || m.timestamp}
                      className={`guide-chat-message max-w-[82%] p-2 rounded border group ${m.senderId === user.id ? 'ml-auto bg-indigo-100 border-indigo-200 text-black' : 'mr-auto bg-white border-gray-200 text-black'}`}
                    >
                      <div className="flex justify-between items-center mb-1 gap-3">
                        <span className="font-bold text-black text-xs">{m.senderName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-black/70">{new Date(m.timestamp).toLocaleString()}</span>
                          {m.senderId === user.id && (
                            <button
                              onClick={() => deleteGroupChat(m.id)}
                              className="text-gray-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Delete message"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-sm">{m.message}</div>
                    </div>
                  ))}
                  {groupChats.length === 0 && <div className="text-center text-gray-500 py-6">No messages yet.</div>}
                </div>
                <div className="flex gap-2 mt-2">
                  <Input value={groupChatMessage} onChange={(e) => setGroupChatMessage(e.target.value)} className="mb-0 flex-1" placeholder="Message this group..." />
                  <Button onClick={sendGroupChat}><Send size={16} /></Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
