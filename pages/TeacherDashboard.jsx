import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../components/Layout.jsx';
import { Card, Badge, Button, Input, Select } from '../components/UI.jsx';
import { ApiService } from '../services/api.js';
import { DIVISIONS, DEPARTMENTS } from '../constants.js';
import { MessageCircle, CheckSquare, Send, Save, Trash2, Clock, PlayCircle, StopCircle, Plus, Users, ArrowRight, Key, AlertTriangle, ChevronLeft, Download, FileText, Link, Paperclip } from 'lucide-react';

const groupChatCacheKey = (groupId) => `group_chat_cache_${groupId}`;
const groupChatSyncKey = (groupId) => `group_chat_sync_${groupId}`;
const guideLastSeenKey = (teacherId, groupId) => `guide_last_seen_${teacherId}_${groupId}`;
const classroomChatCacheKey = (groupId) => `classroom_chat_cache_${groupId}`;
const classroomChatSyncKey = (groupId) => `classroom_chat_sync_${groupId}`;
const classroomSeenKey = (teacherId, groupId) => `classroom_seen_${teacherId}_${groupId}`;
const mergeChatsById = (existing, incoming) => {
  const map = new Map(existing.map(c => [c.id, c]));
  incoming.forEach(c => map.set(c.id, c));
  return Array.from(map.values()).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};
const isNearBottom = (el, threshold = 120) => {
  if (!el) return true;
  return (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
};
const latestTimestamp = (items) => {
  if (!items || items.length === 0) return '';
  return items[items.length - 1].timestamp || '';
};

export const TeacherDashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('TEACHER');

  return (
    <Layout user={user} onLogout={onLogout} title="Teacher Dashboard">
      <div className="teacher-nav">
        <button
          onClick={() => setActiveTab('TEACHER')}
          className={`teacher-nav-btn ${activeTab === 'TEACHER' ? 'active' : ''}`}
        >
          Teacher Tab (Classroom)
        </button>
        <button
          onClick={() => setActiveTab('GUIDE')}
          className={`teacher-nav-btn ${activeTab === 'GUIDE' ? 'active' : ''}`}
        >
          Guide Tab (Projects)
        </button>
      </div>

      <div className="animate-fadeIn">
        {activeTab === 'TEACHER' ? <TeacherTab user={user} /> : <GuideTab user={user} />}
      </div>
    </Layout>
  );
};

const TeacherTab = ({ user }) => {
  const [subTab, setSubTab] = useState('TEST');
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 sub-menu">
        <button onClick={() => setSubTab('TEST')} className={`sub-menu-btn ${subTab === 'TEST' ? 'active' : ''}`}>
          <CheckSquare size={20} />
          <span className="font-semibold">Test Management</span>
        </button>
        <button onClick={() => setSubTab('GROUPS')} className={`sub-menu-btn ${subTab === 'GROUPS' ? 'active' : ''}`}>
          <Users size={20} />
          <span className="font-semibold">Classroom Groups</span>
        </button>
      </div>
      
      <div className="lg:col-span-3">
        {subTab === 'TEST' && <TestManager user={user} />}
        {subTab === 'GROUPS' && <ClassroomGroupsManager user={user} />}
      </div>
    </div>
  );
};

const TestManager = ({ user }) => {
  const [mode, setMode] = useState('CREATE'); // CREATE, ASSIGN, ASSIGNED, SUBMITTED, VIOLATIONS
  const [quizzes, setQuizzes] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [results, setResults] = useState([]);
  const [violations, setViolations] = useState([]);
  const [selectedViolationTest, setSelectedViolationTest] = useState(null);

  useEffect(() => {
    refreshData();
  }, [mode]);

  const refreshData = async () => {
    const [allQuizzes, allAssignments] = await Promise.all([
      ApiService.getQuizzes(),
      ApiService.getTestAssignments()
    ]);
    const teacherQuizzes = allQuizzes.filter(q => q.createdBy === user.id);
    setQuizzes(teacherQuizzes);
    setAssignments(allAssignments.filter(a => a.assignedBy === user.id));
    
    if (mode === 'SUBMITTED') {
      const res = await ApiService.getQuizResults();
      const myQuizIds = teacherQuizzes.map(q => q.id);
      setResults(res.filter(r => myQuizIds.includes(r.quizId)));
    }

    if (mode === 'VIOLATIONS') {
      const allViolations = await ApiService.getViolations();
      // Filter violations based on matching test names
      const myTitles = teacherQuizzes.map(q => q.title);
      setViolations(allViolations.filter(v => myTitles.includes(v.testName)));
    }
  };

  const deleteStudentViolations = async (testName, studentName) => {
    const rows = violations.filter(v => v.testName === testName && v.studentName === studentName);
    if (rows.length === 0) return;
    if (!window.confirm(`Delete all ${rows.length} violations for ${studentName}?`)) return;
    await Promise.all(rows.map(v => ApiService.deleteViolation(v.id)));
    refreshData();
  };

  const deleteAllViolations = async () => {
    if(!window.confirm("Are you sure you want to delete ALL violation records? This cannot be undone.")) return;
    await ApiService.deleteAllViolations();
    refreshData();
  };

  return (
    <Card>
      <div className="flex border-b mb-4 overflow-x-auto">
        {['CREATE', 'ASSIGN', 'ASSIGNED', 'SUBMITTED', 'VIOLATIONS'].map(m => (
          <button 
            key={m} 
            onClick={() => { setMode(m); setSelectedViolationTest(null); }}
            className={`flex-1 py-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors ${mode === m ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === 'CREATE' && <QuizCreator user={user} quizzes={quizzes} onCreated={() => { refreshData(); }} />}
      {mode === 'ASSIGN' && <QuizAssigner quizzes={quizzes} user={user} onAssigned={() => { refreshData(); setMode('ASSIGNED'); }} />}
      {mode === 'ASSIGNED' && <AssignedTestsList assignments={assignments} onUpdate={refreshData} />}
      {mode === 'SUBMITTED' && <TestResultsList results={results} onUpdate={refreshData} />}
      
      {mode === 'VIOLATIONS' && (
        !selectedViolationTest ? (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
               <h3 className="font-bold text-gray-700">Tests with Violations</h3>
               {violations.length > 0 && (
                 <Button variant="danger" size="sm" onClick={deleteAllViolations}>
                   <Trash2 size={16}/> Delete All
                 </Button>
               )}
             </div>
             {(() => {
                const uniqueTests = [...new Set(violations.map(v => v.testName))];
                if (uniqueTests.length === 0) return <p className="text-gray-500 text-center py-4">No violations recorded.</p>;
                return (
                  <div className="grid gap-3">
                    {uniqueTests.map(testName => {
                       const count = violations.filter(v => v.testName === testName).length;
                       return (
                         <div key={testName} onClick={() => setSelectedViolationTest(testName)} className="p-4 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center">
                            <span className="font-bold">{testName}</span>
                            <Badge color="red">{count} Violations</Badge>
                         </div>
                       );
                    })}
                  </div>
                );
             })()}
          </div>
        ) : (
          <div>
             <div className="flex items-center gap-2 mb-4">
               <button onClick={() => setSelectedViolationTest(null)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft/></button>
               <h3 className="font-bold text-lg">{selectedViolationTest} - Violations</h3>
             </div>
             <div className="table-wrapper">
               <table className="w-full text-sm text-left">
                 <thead className="bg-red-50 text-xs uppercase text-red-700">
                   <tr>
                     <th className="px-4 py-2">Student</th>
                     <th className="px-4 py-2">Violation Count</th>
                     <th className="px-4 py-2">Latest Timestamp</th>
                     <th className="px-4 py-2">Action</th>
                   </tr>
                 </thead>
                 <tbody>
                   {(() => {
                     const grouped = violations
                       .filter(v => v.testName === selectedViolationTest)
                       .reduce((acc, v) => {
                         const key = v.studentName || 'Unknown';
                         if (!acc[key]) {
                           acc[key] = { studentName: key, count: 0, latestTimestamp: v.timestamp || '', lastId: v.id };
                         }
                         acc[key].count += 1;
                         if (v.timestamp && (!acc[key].latestTimestamp || new Date(v.timestamp) > new Date(acc[key].latestTimestamp))) {
                           acc[key].latestTimestamp = v.timestamp;
                           acc[key].lastId = v.id;
                         }
                         return acc;
                       }, {});
                     return Object.values(grouped).map(row => (
                       <tr key={row.lastId} className="border-b border-red-100 hover:bg-red-50">
                         <td className="px-4 py-2 font-medium text-red-900">{row.studentName}</td>
                         <td className="px-4 py-2 text-xs text-red-600">{row.count}</td>
                         <td className="px-4 py-2 text-xs text-red-600">{row.latestTimestamp ? new Date(row.latestTimestamp).toLocaleString() : '-'}</td>
                         <td>
                           <button onClick={() => deleteStudentViolations(selectedViolationTest, row.studentName)} className="text-red-600 hover:text-red-800">
                             <Trash2 size={16}/>
                           </button>
                         </td>
                       </tr>
                     ));
                   })()}
                 </tbody>
               </table>
             </div>
          </div>
        )
      )}
    </Card>
  );
};

const QuizCreator = ({ user, quizzes, onCreated }) => {
  const [quiz, setQuiz] = useState({ title: '', questions: [], timeLimit: 30, collegeYear: '', semester: '' });
  const [currentQ, setCurrentQ] = useState({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', correct: 0 });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [editorQuiz, setEditorQuiz] = useState(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);
  const [editorQuestion, setEditorQuestion] = useState({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', correct: '0' });

  useEffect(() => {
    if (!selectedTemplateId) {
      setEditorQuiz(null);
      return;
    }
    const selected = quizzes.find(q => q.id === selectedTemplateId);
    if (!selected) {
      setSelectedTemplateId('');
      setEditorQuiz(null);
      return;
    }
    setEditorQuiz(JSON.parse(JSON.stringify(selected)));
    setEditingQuestionIndex(null);
    setEditorQuestion({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', correct: '0' });
  }, [selectedTemplateId, quizzes]);

  const addQuestion = () => {
    if (!currentQ.text || !currentQ.opt1) return;
    const newQ = {
      id: `q${Date.now()}`,
      text: currentQ.text,
      options: [currentQ.opt1, currentQ.opt2, currentQ.opt3, currentQ.opt4],
      correctOption: currentQ.correct
    };
    setQuiz({ ...quiz, questions: [...(quiz.questions || []), newQ] });
    setCurrentQ({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', correct: 0 });
  };

  const saveQuiz = async () => {
    if (!quiz.title || (quiz.questions?.length || 0) === 0) return alert("Title and questions required.");
    if (!quiz.collegeYear || !quiz.semester) return alert("Year and Semester required.");
    
    await ApiService.addQuiz({
      id: `qz${Date.now()}`,
      title: quiz.title,
      createdBy: user.id,
      questions: quiz.questions,
      timeLimit: parseInt(quiz.timeLimit),
      collegeYear: parseInt(quiz.collegeYear),
      semester: parseInt(quiz.semester)
    });
    alert('Quiz created!');
    setQuiz({ title: '', questions: [], timeLimit: 30, collegeYear: '', semester: '' });
    onCreated();
  };

  const deleteQuiz = async (id) => {
    if(!window.confirm("Delete this quiz template?")) return;
    await ApiService.deleteQuiz(id);
    if (selectedTemplateId === id) {
      setSelectedTemplateId('');
      setEditorQuiz(null);
    }
    onCreated();
  };

  const loadQuestionIntoEditor = (idx) => {
    if (!editorQuiz?.questions?.[idx]) return;
    const q = editorQuiz.questions[idx];
    setEditingQuestionIndex(idx);
    setEditorQuestion({
      text: q.text || '',
      opt1: q.options?.[0] || '',
      opt2: q.options?.[1] || '',
      opt3: q.options?.[2] || '',
      opt4: q.options?.[3] || '',
      correct: String(q.correctOption ?? 0)
    });
  };

  const resetEditorQuestionDraft = () => {
    setEditingQuestionIndex(null);
    setEditorQuestion({ text: '', opt1: '', opt2: '', opt3: '', opt4: '', correct: '0' });
  };

  const saveEditedQuestion = () => {
    if (!editorQuiz || editingQuestionIndex === null) return;
    if (!editorQuestion.text || !editorQuestion.opt1) return alert("Question text and option 1 are required.");
    const updatedQuestions = [...(editorQuiz.questions || [])];
    updatedQuestions[editingQuestionIndex] = {
      ...updatedQuestions[editingQuestionIndex],
      text: editorQuestion.text,
      options: [editorQuestion.opt1, editorQuestion.opt2, editorQuestion.opt3, editorQuestion.opt4],
      correctOption: parseInt(editorQuestion.correct, 10)
    };
    setEditorQuiz({ ...editorQuiz, questions: updatedQuestions });
    resetEditorQuestionDraft();
  };

  const addQuestionToSelectedQuiz = () => {
    if (!editorQuiz) return;
    if (!editorQuestion.text || !editorQuestion.opt1) return alert("Question text and option 1 are required.");
    const newQ = {
      id: `q${Date.now()}`,
      text: editorQuestion.text,
      options: [editorQuestion.opt1, editorQuestion.opt2, editorQuestion.opt3, editorQuestion.opt4],
      correctOption: parseInt(editorQuestion.correct, 10)
    };
    setEditorQuiz({ ...editorQuiz, questions: [...(editorQuiz.questions || []), newQ] });
    resetEditorQuestionDraft();
  };

  const saveEditedQuiz = async () => {
    if (!editorQuiz) return;
    if (!editorQuiz.title || (editorQuiz.questions?.length || 0) === 0) return alert("Quiz title and at least one question are required.");
    if (!editorQuiz.collegeYear || !editorQuiz.semester) return alert("Year and Semester are required.");
    await ApiService.updateQuiz(editorQuiz.id, {
      ...editorQuiz,
      timeLimit: parseInt(editorQuiz.timeLimit, 10),
      collegeYear: parseInt(editorQuiz.collegeYear, 10),
      semester: parseInt(editorQuiz.semester, 10)
    });
    alert("Quiz updated successfully.");
    onCreated();
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700">Create New Quiz</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Quiz Title" value={quiz.title} onChange={e => setQuiz({...quiz, title: e.target.value})} />
          <Input label="Time Limit (mins)" type="number" value={quiz.timeLimit} onChange={e => setQuiz({...quiz, timeLimit: e.target.value})} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select 
             label="College Year" 
             options={['1','2','3','4'].map(y => ({value:y, label:`${y} Year`}))}
             value={quiz.collegeYear} 
             onChange={e => setQuiz({...quiz, collegeYear: e.target.value})} 
          />
          <Select 
             label="Semester" 
             options={['1','2','3','4','5','6','7','8'].map(s => ({value:s, label:`Semester ${s}`}))}
             value={quiz.semester} 
             onChange={e => setQuiz({...quiz, semester: e.target.value})} 
          />
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="font-semibold mb-3 force-black-text">Add Question</h4>
          <Input className="mb-2" placeholder="Question Text" value={currentQ.text} onChange={e => setCurrentQ({...currentQ, text: e.target.value})} />
          <div className="grid grid-cols-2 gap-2 mb-2">
              <Input placeholder="Option 1" value={currentQ.opt1} onChange={e => setCurrentQ({...currentQ, opt1: e.target.value})} />
              <Input placeholder="Option 2" value={currentQ.opt2} onChange={e => setCurrentQ({...currentQ, opt2: e.target.value})} />
              <Input placeholder="Option 3" value={currentQ.opt3} onChange={e => setCurrentQ({...currentQ, opt3: e.target.value})} />
              <Input placeholder="Option 4" value={currentQ.opt4} onChange={e => setCurrentQ({...currentQ, opt4: e.target.value})} />
          </div>
          <div className="force-black-label">
            <Select label="Correct Option" options={[{value:'0', label:'Option 1'}, {value:'1', label:'Option 2'}, {value:'2', label:'Option 3'}, {value:'3', label:'Option 4'}]} value={currentQ.correct} onChange={e => setCurrentQ({...currentQ, correct: parseInt(e.target.value)})} />
          </div>
          <Button onClick={addQuestion} variant="secondary" className="mt-2 w-full force-black-text">Add Question</Button>
        </div>

        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Questions ({quiz.questions?.length})</h4>
          <Button onClick={saveQuiz} className="w-full">Create Quiz Template</Button>
        </div>
      </div>

      <div className="border-t pt-6">
         <h3 className="font-semibold text-gray-700 mb-4 force-black-text">My Created Quizzes</h3>
         <div className="space-y-2 max-h-60 overflow-y-auto">
            {quizzes.map(q => (
              <div
                key={q.id}
                onClick={() => setSelectedTemplateId(q.id)}
                className={`p-3 border rounded flex justify-between items-center bg-white cursor-pointer transition-colors ${selectedTemplateId === q.id ? 'ring-2 ring-indigo-500 border-indigo-400' : 'hover:bg-gray-50'}`}
              >
                 <div>
                    <div className="font-bold force-black-text">{q.title}</div>
                    <div className="text-xs text-gray-500">
                       {q.questions.length} Qs | {q.timeLimit} Mins | Year {q.collegeYear} Sem {q.semester}
                    </div>
                 </div>
                 <button
                   onClick={(e) => { e.stopPropagation(); deleteQuiz(q.id); }}
                   className="text-red-500 hover:bg-red-50 p-2 rounded"
                 >
                   <Trash2 size={16}/>
                 </button>
              </div>
            ))}
            {quizzes.length === 0 && <p className="text-gray-400 text-center">No quizzes created yet.</p>}
         </div>

         {editorQuiz && (
           <div className="mt-6 p-4 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-4">
             <div className="flex items-center justify-between">
               <h4 className="font-bold text-indigo-700">Edit Quiz: {editorQuiz.title}</h4>
               <Button size="sm" variant="outline" onClick={() => setSelectedTemplateId('')}>Close</Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Input label="Quiz Title" value={editorQuiz.title || ''} onChange={e => setEditorQuiz({ ...editorQuiz, title: e.target.value })} />
               <Input label="Time Limit (mins)" type="number" value={editorQuiz.timeLimit || ''} onChange={e => setEditorQuiz({ ...editorQuiz, timeLimit: e.target.value })} />
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <Select
                 label="College Year"
                 options={['1','2','3','4'].map(y => ({ value: y, label: `${y} Year` }))}
                 value={String(editorQuiz.collegeYear || '')}
                 onChange={e => setEditorQuiz({ ...editorQuiz, collegeYear: e.target.value })}
               />
               <Select
                 label="Semester"
                 options={['1','2','3','4','5','6','7','8'].map(s => ({ value: s, label: `Semester ${s}` }))}
                 value={String(editorQuiz.semester || '')}
                 onChange={e => setEditorQuiz({ ...editorQuiz, semester: e.target.value })}
               />
             </div>

             <div className="space-y-2 max-h-72 overflow-y-auto border rounded-lg p-3 bg-white">
               {(editorQuiz.questions || []).map((q, idx) => (
                 <div key={q.id || idx} className="p-3 border rounded-lg">
                   <div className="flex items-start justify-between gap-2">
                     <div>
                       <div className="font-semibold">Q{idx + 1}. {q.text}</div>
                       <div className="text-xs text-gray-500 mt-1">Correct: Option {(Number(q.correctOption) || 0) + 1}</div>
                     </div>
                     <Button size="sm" variant="outline" onClick={() => loadQuestionIntoEditor(idx)}>Edit</Button>
                   </div>
                   <ul className="mt-2 text-sm text-gray-700 space-y-1">
                     {(q.options || []).map((opt, optIdx) => (
                       <li key={optIdx}>Option {optIdx + 1}: {opt}</li>
                     ))}
                   </ul>
                 </div>
               ))}
               {(editorQuiz.questions || []).length === 0 && <div className="text-sm text-gray-500 text-center py-4">No questions in this quiz.</div>}
             </div>

             <div className="p-3 rounded-lg border bg-white space-y-3">
               <h5 className="font-semibold">{editingQuestionIndex !== null ? `Edit Question ${editingQuestionIndex + 1}` : 'Add New Question'}</h5>
               <Input placeholder="Question Text" value={editorQuestion.text} onChange={e => setEditorQuestion({ ...editorQuestion, text: e.target.value })} />
               <div className="grid grid-cols-2 gap-2">
                 <Input placeholder="Option 1" value={editorQuestion.opt1} onChange={e => setEditorQuestion({ ...editorQuestion, opt1: e.target.value })} />
                 <Input placeholder="Option 2" value={editorQuestion.opt2} onChange={e => setEditorQuestion({ ...editorQuestion, opt2: e.target.value })} />
                 <Input placeholder="Option 3" value={editorQuestion.opt3} onChange={e => setEditorQuestion({ ...editorQuestion, opt3: e.target.value })} />
                 <Input placeholder="Option 4" value={editorQuestion.opt4} onChange={e => setEditorQuestion({ ...editorQuestion, opt4: e.target.value })} />
               </div>
               <Select
                 label="Correct Option"
                 options={[{ value: '0', label: 'Option 1' }, { value: '1', label: 'Option 2' }, { value: '2', label: 'Option 3' }, { value: '3', label: 'Option 4' }]}
                 value={editorQuestion.correct}
                 onChange={e => setEditorQuestion({ ...editorQuestion, correct: e.target.value })}
               />
               <div className="flex gap-2">
                 {editingQuestionIndex !== null ? (
                   <>
                     <Button variant="secondary" onClick={saveEditedQuestion}>Save Question</Button>
                     <Button variant="outline" onClick={resetEditorQuestionDraft}>Cancel</Button>
                   </>
                 ) : (
                   <Button variant="secondary" onClick={addQuestionToSelectedQuiz}>Add Question To Quiz</Button>
                 )}
               </div>
             </div>

             <div className="flex justify-end">
               <Button onClick={saveEditedQuiz}><Save size={16}/> Save Quiz Changes</Button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

const QuizAssigner = ({ quizzes, user, onAssigned }) => {
  const [selectedQuiz, setSelectedQuiz] = useState('');
  const [division, setDivision] = useState(DIVISIONS[0]);
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [filterYear, setFilterYear] = useState('');
  const [filterSem, setFilterSem] = useState('');

  const filteredQuizzes = quizzes.filter(q => {
     if(filterYear && q.collegeYear !== parseInt(filterYear)) return false;
     if(filterSem && q.semester !== parseInt(filterSem)) return false;
     return true;
  });

  const handleAssign = async () => {
    if (!selectedQuiz) return;
    const quiz = quizzes.find(q => q.id === selectedQuiz);
    
    await ApiService.assignTest({
      id: `ta${Date.now()}`,
      quizId: quiz.id,
      quizTitle: quiz.title,
      assignedBy: user.id,
      division,
      department,
      assignedDate: new Date().toISOString(),
      isActive: false
    });
    alert(`Assigned ${quiz.title} to ${department} - Div ${division}`);
    onAssigned();
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 py-4">
       <div className="grid grid-cols-2 gap-4">
          <Select 
             label="Filter Year" 
             options={['1','2','3','4'].map(y => ({value:y, label:`${y} Year`}))}
             value={filterYear} 
             onChange={e => setFilterYear(e.target.value)} 
          />
          <Select 
             label="Filter Semester" 
             options={['1','2','3','4','5','6','7','8'].map(s => ({value:s, label:`Semester ${s}`}))}
             value={filterSem} 
             onChange={e => setFilterSem(e.target.value)} 
          />
       </div>

       <Select 
          label="Select Quiz Template" 
          options={filteredQuizzes.map(q => ({value: q.id, label: `${q.title} (Yr ${q.collegeYear})`}))} 
          value={selectedQuiz} 
          onChange={e => setSelectedQuiz(e.target.value)} 
       />
       
       <div className="grid grid-cols-2 gap-4">
          <Select label="Department" options={DEPARTMENTS.map(d => ({value:d, label:d}))} value={department} onChange={e => setDepartment(e.target.value)} />
          <Select label="Division" options={DIVISIONS.map(d => ({value:d, label:d}))} value={division} onChange={e => setDivision(e.target.value)} />
       </div>
       <Button onClick={handleAssign} className="w-full">Assign to Class</Button>
    </div>
  );
};

const AssignedTestsList = ({ assignments, onUpdate }) => {
  const toggleActive = async (a) => {
    await ApiService.updateTestAssignment(a.id, { isActive: !a.isActive });
    onUpdate();
  };
  
  const deleteAssignment = async (id) => {
    if(!window.confirm("Remove this assignment?")) return;
    await ApiService.deleteTestAssignment(id);
    onUpdate();
  };

  return (
    <div className="space-y-3">
       {assignments.map(a => (
         <div key={a.id} className="p-4 border rounded-lg flex justify-between items-center bg-white">
            <div>
               <h4 className="font-bold">{a.quizTitle}</h4>
               <p className="text-sm text-gray-500">{a.department} - Div {a.division}</p>
            </div>
            <div className="flex items-center gap-2">
               <Button variant={a.isActive ? 'danger' : 'primary'} size="sm" onClick={() => toggleActive(a)}>
                  {a.isActive ? <><StopCircle size={16} /> Stop</> : <><PlayCircle size={16} /> Start Test</>}
               </Button>
               <button onClick={() => deleteAssignment(a.id)} className="text-red-500 hover:bg-red-50 p-2 rounded"><Trash2 size={18}/></button>
            </div>
         </div>
       ))}
       {assignments.length === 0 && <p className="text-center text-gray-500">No tests assigned yet.</p>}
    </div>
  );
};

const TestResultsList = ({ results, onUpdate }) => {
  const [filterDept, setFilterDept] = useState('');
  const [filterDiv, setFilterDiv] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSem, setFilterSem] = useState('');
  const [pruneMonths, setPruneMonths] = useState('');

  const filteredResults = results.filter(r => {
     if(filterDept && r.department !== filterDept) return false;
     if(filterDiv && r.division !== filterDiv) return false;
     if(filterYear && r.collegeYear !== parseInt(filterYear)) return false;
     if(filterSem && r.semester !== parseInt(filterSem)) return false;
     return true;
  });

  const exportCSV = () => {
     if(filteredResults.length === 0) return alert("No data to export");
     const headers = ["College Year", "Semester", "PRN", "Student Name", "Division", "Department", "Test Name", "Score", "Total", "Date"];
     const rows = filteredResults.map(r => [
        r.collegeYear || '',
        r.semester || '',
        r.prn || '',
        r.studentName,
        r.division,
        r.department,
        r.quizTitle,
        r.score,
        r.totalQuestions,
        new Date(r.date).toLocaleDateString()
     ]);
     
     const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
     const blob = new Blob([csvContent], { type: 'text/csv' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `results_export.csv`;
     a.click();
  };

  const handlePrune = async () => {
     if(!pruneMonths) return alert("Enter months");
     if(!confirm(`Delete records older than ${pruneMonths} months?`)) return;
     const res = await ApiService.pruneResults(parseInt(pruneMonths));
     alert(`Deleted ${res.deletedCount} old records.`);
     onUpdate();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
         <Select options={DEPARTMENTS.map(d=>({value:d, label:d}))} value={filterDept} onChange={e=>setFilterDept(e.target.value)} label="Dept"/>
         <Select options={DIVISIONS.map(d=>({value:d, label:d}))} value={filterDiv} onChange={e=>setFilterDiv(e.target.value)} label="Div"/>
         <Select options={['1','2','3','4'].map(y=>({value:y, label:`Yr ${y}`}))} value={filterYear} onChange={e=>setFilterYear(e.target.value)} label="Year"/>
         <Select options={['1','2','3','4','5','6','7','8'].map(s=>({value:s, label:`Sem ${s}`}))} value={filterSem} onChange={e=>setFilterSem(e.target.value)} label="Sem"/>
      </div>
      
      <div className="flex justify-between items-center bg-gray-50 p-2 rounded">
         <Button size="sm" variant="secondary" onClick={exportCSV}><Download size={16}/> Export CSV</Button>
         <div className="flex items-center gap-2">
            <input type="number" placeholder="Months old" className="ui-input w-24 py-1" value={pruneMonths} onChange={e=>setPruneMonths(e.target.value)} />
            <Button size="sm" variant="danger" onClick={handlePrune}>Clear Old</Button>
         </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-xs uppercase">
            <tr>
              <th className="px-4 py-2">PRN</th>
              <th className="px-4 py-2">Student</th>
              <th className="px-4 py-2">Test</th>
              <th className="px-4 py-2">Score</th>
              <th className="px-4 py-2">Yr/Sem</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredResults.map(r => (
              <tr key={r.id} className="border-b">
                <td className="px-4 py-2 text-xs font-mono">{r.prn || '-'}</td>
                <td className="px-4 py-2 font-medium">
                   {r.studentName}
                   <div className="text-xs text-gray-400">{r.department} {r.division}</div>
                </td>
                <td className="px-4 py-2">{r.quizTitle}</td>
                <td className="px-4 py-2 text-indigo-600 font-bold">{r.score} / {r.totalQuestions}</td>
                <td className="px-4 py-2">{r.collegeYear ? `Y${r.collegeYear} S${r.semester}` : '-'}</td>
                <td className="px-4 py-2">
                   {r.submissionType === 'VIOLATION_AUTO_SUBMIT' ? 
                      <Badge color="red">Auto</Badge> : 
                      <Badge color="green">Ok</Badge>
                   }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ClassroomGroupsManager = ({ user }) => {
  const [groups, setGroups] = useState([]);
  const [mode, setMode] = useState('GROUPS');
  const [newGroupName, setNewGroupName] = useState('');
  const [joinKey, setJoinKey] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [message, setMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]);
  const [unreadMap, setUnreadMap] = useState({});
  const pollRef = useRef(0);
  const bottomRef = useRef(null);
  const forceAutoScrollRef = useRef(false);

  useEffect(() => {
    fetchGroups();
    const interval = setInterval(fetchGroups, 7000);
    return () => clearInterval(interval);
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (!activeMessages.length) return;
    if (forceAutoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      forceAutoScrollRef.current = false;
    }
  }, [activeMessages]);

  const fetchGroups = async () => {
    const all = await ApiService.getClassroomGroups();
    const mine = all.filter(g => g.teacherId === user.id || g.studentIds.includes(user.id));
    const getLatestForGroup = (g) => {
      const apiLatest = latestTimestamp(g.messages || []);
      const localLatest = localStorage.getItem(classroomChatSyncKey(g.id)) || '';
      if (!apiLatest) return localLatest;
      if (!localLatest) return apiLatest;
      return new Date(apiLatest) > new Date(localLatest) ? apiLatest : localLatest;
    };
    const sorted = [...mine].sort((a, b) => {
      const aTs = getLatestForGroup(a);
      const bTs = getLatestForGroup(b);
      if (!aTs && !bTs) return 0;
      if (!aTs) return 1;
      if (!bTs) return -1;
      return new Date(bTs) - new Date(aTs);
    });
    const unread = {};
    sorted.forEach(g => {
      const latest = getLatestForGroup(g);
      const seen = localStorage.getItem(classroomSeenKey(user.id, g.id)) || '';
      unread[g.id] = !!latest && (!seen || new Date(latest) > new Date(seen)) && selectedGroup?.id !== g.id;
    });
    setUnreadMap(unread);
    setGroups(sorted);
  };

  const createGroup = async () => {
    if (!newGroupName) return;
    const key = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ApiService.addClassroomGroup({
      id: `cg${Date.now()}`,
      name: newGroupName,
      joinKey: key,
      teacherId: user.id,
      teacherName: user.fullName,
      studentIds: [],
      messages: []
    });
    setNewGroupName('');
    fetchGroups();
    alert(`Group Created! Key: ${key}`);
    setMode('KEYS');
  };

  const deleteGroup = async (g) => {
    if(!window.confirm("Delete group? This will remove it for all members.")) return;
    await ApiService.deleteClassroomGroup(g.id);
    fetchGroups();
    setSelectedGroup(null);
    setMode('GROUPS');
  };

  const joinGroup = async () => {
    const all = await ApiService.getClassroomGroups();
    const group = all.find(g => g.joinKey === joinKey.toUpperCase());
    if (!group) return alert("Invalid Key");
    if (group.teacherId === user.id) return alert("You created this group.");
    if (group.studentIds.includes(user.id)) return alert("Already joined.");
    
    await ApiService.updateClassroomGroup(group.id, {
      ...group,
      studentIds: [...group.studentIds, user.id]
    });
    alert("Joined Group!");
    setJoinKey('');
    fetchGroups();
    setMode('GROUPS');
  };

  const syncMessages = async (groupId, forceFull = false) => {
    const cacheKey = classroomChatCacheKey(groupId);
    const syncKey = classroomChatSyncKey(groupId);
    const since = forceFull ? '' : (localStorage.getItem(syncKey) || '');
    const fresh = await ApiService.getClassroomGroupMessages(groupId, { since: since || undefined });
    setActiveMessages(prev => {
      const next = forceFull ? fresh : mergeChatsById(prev, fresh);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      localStorage.setItem(classroomSeenKey(user.id, groupId), ts || '');
      return next;
    });
    setUnreadMap(prev => ({ ...prev, [groupId]: false }));
  };

  const openChat = async (group) => {
    setSelectedGroup(group);
    setMode('CHAT');
    forceAutoScrollRef.current = true;
    pollRef.current = 0;
    const cacheKey = classroomChatCacheKey(group.id);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      setActiveMessages(Array.isArray(cached) ? cached : []);
    } catch (_) {
      setActiveMessages([]);
    }
    await syncMessages(group.id, false);
  };

  useEffect(() => {
    if (mode !== 'CHAT' || !selectedGroup?.id) return;
    const interval = setInterval(async () => {
      pollRef.current += 1;
      await syncMessages(selectedGroup.id, pollRef.current % 12 === 0);
    }, 2000);
    return () => clearInterval(interval);
  }, [mode, selectedGroup?.id]);

  const sendMessage = async () => {
    if ((!message.trim() && !pendingFile) || !selectedGroup) return;
    const msgData = {
      id: `cm${Date.now()}`,
      senderId: user.id,
      senderName: user.fullName,
      role: 'TEACHER',
      message: message.trim(),
      fileName: pendingFile?.fileName || '',
      fileType: pendingFile?.fileType || '',
      fileData: pendingFile?.fileData || '',
      timestamp: new Date().toISOString()
    };
    await ApiService.addClassroomGroupMessage(selectedGroup.id, msgData);
    const cacheKey = classroomChatCacheKey(selectedGroup.id);
    const syncKey = classroomChatSyncKey(selectedGroup.id);
    setActiveMessages(prev => {
      const next = mergeChatsById(prev, [msgData]);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      localStorage.setItem(classroomSeenKey(user.id, selectedGroup.id), ts || '');
      return next;
    });
    setMessage('');
    setPendingFile(null);
    forceAutoScrollRef.current = true;
    fetchGroups();
  };

  const deleteMessage = async (messageId) => {
    if (!selectedGroup?.id) return;
    await ApiService.deleteClassroomGroupMessage(selectedGroup.id, messageId, user.id);
    const cacheKey = classroomChatCacheKey(selectedGroup.id);
    const syncKey = classroomChatSyncKey(selectedGroup.id);
    setActiveMessages(prev => {
      const next = prev.filter(m => m.id !== messageId);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      return next;
    });
    fetchGroups();
  };

  const handleAttachment = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/\.(ppt|pptx|doc|docx|xls|xlsx)$/i.test(file.name)) {
      alert('Only PPT, Word, and Excel files are allowed.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPendingFile({
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        fileData: reader.result
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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
            {groups.map(g => (
              <div key={g.id} className="p-3 border rounded bg-white hover:shadow-md cursor-pointer flex justify-between items-center" onClick={() => openChat(g)}>
                 <div>
                    <div className="font-bold flex items-center gap-2">
                      <span className="text-black">{g.name}</span>
                      {unreadMap[g.id] && <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>}
                    </div>
                    <div className="text-xs text-gray-500">{g.teacherId === user.id ? 'Created by Me' : `Teacher: ${g.teacherName}`}</div>
                 </div>
                 <div className="flex items-center gap-2">
                   {g.teacherId === user.id && (
                     <button onClick={(e) => { e.stopPropagation(); deleteGroup(g); }} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                   )}
                   <MessageCircle size={20} className="text-indigo-600"/>
                 </div>
              </div>
            ))}
            {groups.length === 0 && <p className="text-gray-400 text-center py-4">No groups yet.</p>}
         </div>
       )}

       {mode === 'CREATE' && (
         <div className="max-w-sm mx-auto py-4 space-y-3">
            <Input label="Group Name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
            <Button onClick={createGroup} className="w-full">Generate Key & Create</Button>
         </div>
       )}

       {mode === 'KEYS' && (
         <div className="space-y-2">
            {groups.filter(g => g.teacherId === user.id).map(g => (
               <div key={g.id} className="p-3 bg-indigo-50 border border-indigo-100 rounded flex justify-between">
                  <span className="font-semibold text-black">{g.name}</span>
                  <span className="font-mono bg-white px-2 rounded border text-black">{g.joinKey}</span>
               </div>
            ))}
            {groups.filter(g => g.teacherId === user.id).length === 0 && <p className="text-center text-gray-400">You haven't created any groups.</p>}
         </div>
       )}

       {mode === 'JOIN' && (
         <div className="max-w-sm mx-auto py-4 space-y-3">
            <Input label="Enter Group Key" value={joinKey} onChange={e => setJoinKey(e.target.value)} />
            <Button onClick={joinGroup} className="w-full">Join Group</Button>
         </div>
       )}

       {mode === 'CHAT' && selectedGroup && (
          <div className="h-[500px] flex flex-col">
             <div className="border-b pb-2 mb-2 flex justify-between items-center">
                <h3 className="font-bold">{selectedGroup.name}</h3>
                <Button size="sm" variant="outline" onClick={() => setMode('GROUPS')}>Back</Button>
             </div>
             <div className="h-[420px] overflow-y-auto bg-gray-50 p-4 rounded mb-4 space-y-3 chat-scroll-mini group-chat-scrollbar">
                {activeMessages.map((m) => (
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
                      {m.fileData && m.fileName && (
                        <a
                          href={m.fileData}
                          download={m.fileName}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-700 underline break-all"
                        >
                          <FileText size={12} /> {m.fileName}
                        </a>
                      )}
                   </div>
                ))}
                <div ref={bottomRef} />
             </div>
             {selectedGroup.teacherId === user.id ? (
               <>
                 {pendingFile && (
                   <div className="text-xs text-indigo-700 mb-2 px-1 flex items-center justify-between">
                     <span className="truncate">Attachment: {pendingFile.fileName}</span>
                     <button className="text-red-600" onClick={() => setPendingFile(null)}>Remove</button>
                   </div>
                 )}
                 <div className="flex gap-2">
                    <Input placeholder="Message..." value={message} onChange={e => setMessage(e.target.value)} className="mb-0 flex-1" />
                    <label className="inline-flex items-center justify-center px-3 border rounded-lg cursor-pointer hover:bg-gray-50" title="Attach PPT/Word/Excel">
                      <Paperclip size={16} />
                      <input type="file" className="hidden" accept=".ppt,.pptx,.doc,.docx,.xls,.xlsx" onChange={handleAttachment} />
                    </label>
                    <Button onClick={sendMessage}><Send size={18}/></Button>
                 </div>
               </>
             ) : (
               <div className="p-2 bg-gray-100 text-xs text-center text-gray-500 rounded">
                 Read Only Channel
               </div>
             )}
          </div>
       )}
    </Card>
  );
};

const GuideTab = ({ user }) => {
  const [assignedGroups, setAssignedGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMeta, setGroupMeta] = useState({});

  useEffect(() => {
    const fetchGroups = async () => {
      const allAssignments = await ApiService.getAssignments();
      const allProjects = await ApiService.getProjects();
      const allGroups = await ApiService.getGroups();

      const myProjects = allProjects.filter(p => p.guideId === user.id);
      const myProjectIds = myProjects.map(p => p.id);
      const relevantAssignments = allAssignments.filter(a => myProjectIds.includes(a.projectId));

      const displayData = relevantAssignments.map(a => {
        const project = myProjects.find(p => p.id === a.projectId);
        const group = allGroups.find(g => g.id === a.groupId);
        return {
          id: a.id,
          projectId: project?.id,
          groupId: group?.id,
          title: project?.title,
          leader: group?.groupLeader,
          project
        };
      });
      setAssignedGroups(displayData);
    };
    fetchGroups();
  }, [user.id]);

  useEffect(() => {
    if (assignedGroups.length === 0) return;
    const groupIds = assignedGroups.map(g => g.groupId);

    const refreshGroupMeta = async () => {
      const allChats = await ApiService.getChats({ targetType: 'GROUP' });
      const relevant = allChats.filter(c => groupIds.includes(c.targetId));
      const latestByGroup = {};
      relevant.forEach(chat => {
        const prev = latestByGroup[chat.targetId];
        if (!prev || new Date(chat.timestamp) > new Date(prev.timestamp)) {
          latestByGroup[chat.targetId] = { timestamp: chat.timestamp };
        }
      });

      const nextMeta = {};
      groupIds.forEach(groupId => {
        const latest = latestByGroup[groupId]?.timestamp || '';
        const seen = localStorage.getItem(guideLastSeenKey(user.id, groupId)) || '';
        const unread = !!latest && (!seen || new Date(latest) > new Date(seen)) && selectedGroup !== groupId;
        nextMeta[groupId] = { latest, unread };
      });
      setGroupMeta(nextMeta);
    };

    refreshGroupMeta();
    const interval = setInterval(refreshGroupMeta, 5000);
    return () => clearInterval(interval);
  }, [assignedGroups, selectedGroup, user.id]);

  const sortedGroups = [...assignedGroups].sort((a, b) => {
    const aTs = groupMeta[a.groupId]?.latest || '';
    const bTs = groupMeta[b.groupId]?.latest || '';
    if (!aTs && !bTs) return 0;
    if (!aTs) return 1;
    if (!bTs) return -1;
    return new Date(bTs) - new Date(aTs);
  });

  const openGroup = (groupId) => {
    setSelectedGroup(groupId);
    const latest = groupMeta[groupId]?.latest;
    if (latest) {
      localStorage.setItem(guideLastSeenKey(user.id, groupId), latest);
      setGroupMeta(prev => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), unread: false } }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-700">My Project Groups</h3>
        {sortedGroups.map(g => (
          <div 
            key={g.id} 
            onClick={() => openGroup(g.groupId)}
            className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedGroup === g.groupId ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
          >
            <div className="flex items-center justify-between">
              <h4 className={`font-bold ${selectedGroup === g.groupId ? 'text-white' : 'text-black'}`}>{g.title}</h4>
              {groupMeta[g.groupId]?.unread && <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>}
            </div>
            <p className={`text-sm ${selectedGroup === g.groupId ? 'text-white/80' : 'text-black/80'}`}>Leader: {g.leader}</p>
          </div>
        ))}
      </div>
      
      <div className="lg:col-span-2">
        {selectedGroup ? (
           <GroupWorkspace groupId={selectedGroup} user={user} projectData={assignedGroups.find(g => g.groupId === selectedGroup)} />
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400 bg-white rounded-xl border border-dashed">
            Select a group to manage
          </div>
        )}
      </div>
    </div>
  );
};

const GroupWorkspace = ({ groupId, user, projectData }) => {
  const [chats, setChats] = useState([]);
  const [msg, setMsg] = useState('');
  const [rubricScores, setRubricScores] = useState([]);
  const [progress, setProgress] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [markEntry, setMarkEntry] = useState(null);
  const [submission, setSubmission] = useState(null);
  const bottomRef = useRef(null);
  const chatContainerRef = useRef(null);
  const forceAutoScrollRef = useRef(true);
  const groupRef = useRef(groupId);
  const pollCountRef = useRef(0);

  // Sync with student updates (assignment progress)
  const [studentProgress, setStudentProgress] = useState(0);
  const projectRubrics = Array.isArray(projectData?.project?.rubrics) ? projectData.project.rubrics : [];
  const totalProjectMarks = Number(projectData?.project?.totalMarks || projectRubrics.reduce((s, r) => s + (Number(r.maxMarks) || 0), 0));
  const totalObtainedMarks = rubricScores.reduce((sum, r) => sum + (Number(r.obtainedMarks) || 0), 0);

  const getInitialRubricScores = (existingMark) => {
    const existingScores = Array.isArray(existingMark?.rubricScores) ? existingMark.rubricScores : [];
    const byTitle = new Map(existingScores.map(r => [r.title, r]));
    return projectRubrics.map(r => {
      const prev = byTitle.get(r.title);
      return {
        title: r.title,
        maxMarks: Number(r.maxMarks) || 0,
        obtainedMarks: prev?.obtainedMarks ?? ''
      };
    });
  };

  // Load initial data and saved marks on group selection
  useEffect(() => {
    const loadInitialData = async () => {
      const allMarks = await ApiService.getMarks();
      const existingMark = allMarks.find(m => m.groupId === groupId && m.projectId === projectData.projectId);

      // Check assignment for student progress & submission
      const allAssignments = await ApiService.getAssignments();
      const assign = allAssignments.find(a => a.id === projectData.id);
      if (assign) setStudentProgress(assign.progress || 0);

      const allSubs = await ApiService.getSubmissions();
      const sub = allSubs.find(s => s.assignmentId === projectData.id);
      setSubmission(sub || null);
      
      if (existingMark) {
        setMarkEntry(existingMark);
        setRubricScores(getInitialRubricScores(existingMark));
        setProgress(existingMark.progress || 0);
        setIsSubmitted(existingMark.isSubmittedToAdmin);
      } else {
        setMarkEntry(null);
        setRubricScores(getInitialRubricScores(null));
        setProgress(0);
        setIsSubmitted(false);
      }
    };
    loadInitialData();
  }, [groupId, projectData]);

  // Auto-refresh only chats and submission status, NOT form inputs
  useEffect(() => {
    groupRef.current = groupId;
    const cacheKey = groupChatCacheKey(groupId);
    const syncKey = groupChatSyncKey(groupId);
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      if (Array.isArray(cached) && cached.length > 0) {
        forceAutoScrollRef.current = true;
        setChats(cached);
      }
    } catch (_) {}

    const refreshChatsAndStatus = async () => {
      pollCountRef.current += 1;
      const isFullSync = pollCountRef.current % 6 === 0;
      const since = isFullSync ? '' : (localStorage.getItem(syncKey) || '');
      const freshChats = await ApiService.getChats({ since: since || undefined, targetType: 'GROUP', targetId: groupId });
      setChats(prev => {
        const next = isFullSync ? freshChats : mergeChatsById(prev, freshChats);
        localStorage.setItem(cacheKey, JSON.stringify(next));
        const ts = latestTimestamp(next);
        if (ts) localStorage.setItem(syncKey, ts);
        return next;
      });
      
      const allSubs = await ApiService.getSubmissions();
      const sub = allSubs.find(s => s.assignmentId === projectData.id);
      setSubmission(sub || null);
    };
    const interval = setInterval(refreshChatsAndStatus, 5000);
    return () => clearInterval(interval);
  }, [groupId, projectData]);

  // Scroll to bottom when new messages arrive or group changes, but not on every refresh
  const prevChatCountRef = useRef(0);

  useEffect(() => {
    // Scroll when new messages are added or group first loads
    if (chats.length !== prevChatCountRef.current) {
      const shouldScroll = forceAutoScrollRef.current || isNearBottom(chatContainerRef.current);
      if (shouldScroll) {
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 0);
      }
      forceAutoScrollRef.current = false;
      prevChatCountRef.current = chats.length;
    }
  }, [chats]);

  const sendChat = async () => {
    if (!msg.trim()) return;
    const newChat = {
      id: `c${Date.now()}`,
      senderId: user.id,
      senderName: user.fullName,
      targetId: groupId,
      targetType: 'GROUP',
      message: msg.trim(),
      timestamp: new Date().toISOString()
    };
    await ApiService.addChat(newChat);
    const cacheKey = groupChatCacheKey(groupId);
    const syncKey = groupChatSyncKey(groupId);
    setChats(prev => {
      const merged = mergeChatsById(prev, [newChat]);
      localStorage.setItem(cacheKey, JSON.stringify(merged));
      const ts = latestTimestamp(merged);
      if (ts) localStorage.setItem(syncKey, ts);
      return merged;
    });
    forceAutoScrollRef.current = true;
    setMsg('');
  };

  const deleteMessage = async (id) => {
    await ApiService.deleteChat(id);
    const activeGroupId = groupRef.current;
    const cacheKey = groupChatCacheKey(activeGroupId);
    const syncKey = groupChatSyncKey(activeGroupId);
    setChats(prev => {
      const next = prev.filter(c => c.id !== id);
      localStorage.setItem(cacheKey, JSON.stringify(next));
      const ts = latestTimestamp(next);
      if (ts) localStorage.setItem(syncKey, ts);
      return next;
    });
  };

  const setRubricScoreAt = (idx, value) => {
    const numeric = value === '' ? '' : Number(value);
    setRubricScores(prev => prev.map((r, i) => i === idx ? { ...r, obtainedMarks: Number.isFinite(numeric) ? numeric : '' } : r));
  };

  const validateRubricScores = (requireAllFilled = false) => {
    if (projectRubrics.length === 0) return { ok: false, error: 'No rubrics configured by admin for this project.' };
    for (const r of rubricScores) {
      const obtained = r.obtainedMarks === '' ? '' : Number(r.obtainedMarks);
      if (requireAllFilled && (obtained === '' || Number.isNaN(obtained))) {
        return { ok: false, error: `Enter marks for rubric: ${r.title}` };
      }
      if (obtained === '' || Number.isNaN(obtained)) continue;
      if (obtained < 0) return { ok: false, error: `Marks cannot be negative for rubric: ${r.title}` };
      if (obtained > Number(r.maxMarks)) {
        return { ok: false, error: `Marks for "${r.title}" cannot exceed ${r.maxMarks}` };
      }
    }
    return { ok: true };
  };

  const saveProgress = async () => {
    const validation = validateRubricScores(false);
    if (!validation.ok) return alert(validation.error);
    const normalizedScores = rubricScores.map(r => ({
      title: r.title,
      maxMarks: Number(r.maxMarks) || 0,
      obtainedMarks: Number(r.obtainedMarks) || 0
    }));
    const entry = {
      id: markEntry?.id || `m${Date.now()}`,
      groupId,
      projectId: projectData.projectId,
      teacherMarks: normalizedScores.reduce((sum, r) => sum + r.obtainedMarks, 0),
      rubrics: normalizedScores.map(r => `${r.title}:${r.obtainedMarks}/${r.maxMarks}`).join(', '),
      rubricScores: normalizedScores,
      progress: parseInt(progress),
      isSubmittedToAdmin: isSubmitted
    };
    const saved = await ApiService.saveMark(entry);
    setMarkEntry(saved || entry);
    alert("Draft saved");
  };

  const submitMarks = async () => {
    if (!submission) return alert("Student group has not submitted the project yet.");
    const validation = validateRubricScores(true);
    if (!validation.ok) return alert(validation.error);
    const normalizedScores = rubricScores.map(r => ({
      title: r.title,
      maxMarks: Number(r.maxMarks) || 0,
      obtainedMarks: Number(r.obtainedMarks) || 0
    }));
    
    const entry = {
      id: markEntry?.id || `m${Date.now()}`,
      groupId,
      projectId: projectData.projectId,
      teacherMarks: normalizedScores.reduce((sum, r) => sum + r.obtainedMarks, 0),
      rubrics: normalizedScores.map(r => `${r.title}:${r.obtainedMarks}/${r.maxMarks}`).join(', '),
      rubricScores: normalizedScores,
      progress: 100,
      isSubmittedToAdmin: true
    };
    const saved = await ApiService.saveMark(entry);
    setMarkEntry(saved || entry);
    setIsSubmitted(true);
    setProgress(100);
  };

  const unsubmitMarks = async () => {
    if(!isSubmitted) return;
    const entry = {
      ...markEntry,
      isSubmittedToAdmin: false
    };
    await ApiService.saveMark(entry);
    setIsSubmitted(false);
  };

  return (
    <div className="space-y-6">
      <Card title="Project Tracking & Grading">
         <div className="space-y-4">
           {submission ? (
              <div className="bg-green-50 p-3 rounded text-sm text-green-700 mb-2 flex items-center justify-between">
                 <span>Submitted on {new Date(submission.submissionDate).toLocaleDateString()}</span>
                 <div className="flex gap-2">
                    {submission.link && <a href={submission.link} target="_blank" className="underline flex items-center gap-1"><Link size={14}/> Link</a>}
                    {submission.fileName && <span className="flex items-center gap-1"><FileText size={14}/> {submission.fileName}</span>}
                 </div>
              </div>
           ) : (
              <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-700 mb-2 flex items-center gap-2">
                 <AlertTriangle size={16}/> Student has not submitted project file/link yet.
              </div>
           )}

           <div className="bg-blue-50 p-3 rounded text-sm text-blue-700 mb-2">
             Student Self-Reported Progress: <span className="font-bold">{studentProgress}%</span>
           </div>
           
           <div className="space-y-3">
             <div className="flex items-center justify-between">
               <label className="ui-label mb-0">Rubric-wise Marks</label>
               <div className="text-sm font-semibold text-indigo-700">
                 Total: {totalObtainedMarks} / {totalProjectMarks}
               </div>
             </div>
             {projectRubrics.length > 0 ? (
               <div className="space-y-2">
                 {rubricScores.map((r, idx) => (
                   <div key={`${r.title}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center p-2 rounded border border-gray-200">
                     <div className="md:col-span-6">
                       <div className="font-medium text-sm">{r.title}</div>
                     </div>
                     <div className="md:col-span-3 text-sm text-gray-500">
                       Max: {r.maxMarks}
                     </div>
                     <div className="md:col-span-3">
                       <input
                         type="number"
                         min="0"
                         max={r.maxMarks}
                         className="ui-input mb-0"
                         value={r.obtainedMarks}
                         onChange={(e) => setRubricScoreAt(idx, e.target.value)}
                         disabled={isSubmitted}
                       />
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-sm text-red-600 bg-red-50 p-3 rounded">
                 No rubrics configured by admin for this project.
               </div>
             )}
           </div>

           <div className="flex justify-end gap-2 pt-2">
             {!isSubmitted && <Button variant="outline" onClick={saveProgress}>Save Draft</Button>}
             {isSubmitted ? (
               <div className="flex items-center gap-2">
                  <Badge color="green">Submitted to Admin</Badge>
                  <Button size="sm" variant="secondary" onClick={unsubmitMarks}>Unsubmit</Button>
               </div>
             ) : (
               <Button onClick={submitMarks} disabled={!submission || projectRubrics.length === 0}><Save size={16} /> Finalize & Submit</Button>
             )}
           </div>
         </div>
      </Card>

      <Card title={`Chat with ${projectData.leader}'s Group`} className="chat-box">
        <div ref={chatContainerRef} className="chat-messages">
           {chats.map(c => (
             <div key={c.id} className={`chat-msg group ${c.senderId === user.id ? 'ml-auto bg-indigo-50 dark:bg-indigo-900 border-indigo-100 dark:border-indigo-700 max-w-[80%]' : 'mr-auto max-w-[80%]'}`}>
               <div className="flex justify-between items-baseline gap-2">
                  <div className="chat-sender dark:!text-black">{c.senderName}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-gray-400 dark:!text-black/70">{new Date(c.timestamp).toLocaleTimeString()}</div>
                    {c.senderId === user.id && (
                      <button onClick={() => deleteMessage(c.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
               </div>
               {c.message && <div className="text-sm text-gray-900 dark:!text-black">{c.message}</div>}
             </div>
           ))}
           <div ref={bottomRef} />
        </div>
        <div className="flex gap-2">
          <Input placeholder="Message group..." value={msg} onChange={e => setMsg(e.target.value)} className="mb-0 flex-1" />
          <Button onClick={sendChat}><Send size={18} /></Button>
        </div>
      </Card>
    </div>
  );
};
