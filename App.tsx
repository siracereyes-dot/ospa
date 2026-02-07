
import React, { useState, useMemo } from 'react';
import { 
  OSPAScoreState, 
  Level, 
  Rank, 
  Position, 
  Achievement, 
  LeadershipEntry, 
  ServiceEntry, 
  InterviewScores,
  RatingEntry,
  MOVFile
} from './types';
import { SCORING_RUBRIC } from './constants';

const NCR_DIVISIONS = [
  "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila",
  "Marikina", "Muntinlupa", "Navotas", "Parañaque", "Pasay", "Pasig",
  "Quezon City", "San Juan", "Taguig City and Pateros (TAPAT)", "Valenzuela"
];

// NOTE: User must replace this with their actual deployed Google Apps Script URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyar3ji86tD3WubBdAq8aR_zFp-gkzhcyYFtayBuTdFZpoCxpZmyR-7B5Wpbg_9M20D/exec";

const INITIAL_STATE: OSPAScoreState = {
  candidateName: '',
  division: '',
  schoolName: '',
  movFile: null,
  performanceRatings: [
    { year: '2024-2025', score: 4.0 },
    { year: '2023-2024', score: 4.0 },
    { year: '2022-2023', score: 4.0 },
    { year: '2021-2022', score: 4.0 },
    { year: '2020-2021', score: 4.0 },
  ],
  individualContests: [],
  groupContests: [],
  specialAwards: [],
  publicationContests: [],
  leadership: [],
  extensionServices: [],
  innovations: [],
  speakership: [],
  publishedBooks: [],
  publishedArticles: [],
  interview: {
    principles: 0,
    leadership: 0,
    engagement: 0,
    commitment: 0,
    communication: 0
  }
};

const App: React.FC = () => {
  const [data, setData] = useState<OSPAScoreState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<string>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string>('');
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const averageRating = useMemo(() => {
    const sum = data.performanceRatings.reduce((acc, curr) => acc + curr.score, 0);
    return sum / data.performanceRatings.length;
  }, [data.performanceRatings]);

  const totals = useMemo(() => {
    const calculateAchievementScore = (items: Achievement[], rubric: any) => {
      let total = 0;
      Object.values(Level).forEach(lvl => {
        const levelItems = items.filter(i => i.level === lvl);
        const levelRubric = rubric[lvl];
        if (!levelRubric) return;
        let levelPoints = 0;
        levelItems.forEach(item => {
          levelPoints += (levelRubric[item.rank] || 0);
        });
        total += levelPoints * (levelRubric.weight || 0);
      });
      return total;
    };

    const calculateSectionScore = (items: ServiceEntry[], rubric: any) => {
      let totalPoints = 0;
      items.forEach(item => {
        totalPoints += (rubric[item.level] || 0);
      });
      return totalPoints * (rubric.weight || 1);
    };

    const indiv = calculateAchievementScore(data.individualContests, SCORING_RUBRIC.INDIVIDUAL);
    const group = calculateAchievementScore(data.groupContests, SCORING_RUBRIC.GROUP);
    const special = calculateAchievementScore(data.specialAwards, SCORING_RUBRIC.SPECIAL_AWARDS);
    const pub = calculateAchievementScore(data.publicationContests, SCORING_RUBRIC.PUBLICATION);
    
    const leadershipScoresByLevel = { [Level.NATIONAL]: 0, [Level.REGIONAL]: 0, [Level.DIVISION]: 0 };
    data.leadership.forEach(entry => {
      const levelRubric = (SCORING_RUBRIC.LEADERSHIP as any)[entry.level];
      const pts = levelRubric?.[entry.position] || 0;
      if (pts > leadershipScoresByLevel[entry.level as keyof typeof leadershipScoresByLevel]) {
        leadershipScoresByLevel[entry.level as keyof typeof leadershipScoresByLevel] = pts;
      }
    });
    const leadershipTotal = (Object.values(leadershipScoresByLevel) as number[]).reduce((a: number, b: number) => a + b, 0) * SCORING_RUBRIC.LEADERSHIP.weight;

    const extension = calculateSectionScore(data.extensionServices, SCORING_RUBRIC.EXTENSION);
    const innovations = calculateSectionScore(data.innovations, SCORING_RUBRIC.INNOVATIONS);
    const speakership = calculateSectionScore(data.speakership, SCORING_RUBRIC.SPEAKERSHIP);
    const books = calculateSectionScore(data.publishedBooks, SCORING_RUBRIC.BOOKS);
    const articles = calculateSectionScore(data.publishedArticles, SCORING_RUBRIC.ARTICLES);
    
    const interviewRaw = (Object.values(data.interview) as number[]).reduce((a: number, b: number) => a + b, 0);
    const interviewTotal = interviewRaw * 2;

    const grandTotal = indiv + group + special + pub + leadershipTotal + extension + innovations + speakership + books + articles + interviewTotal;

    return {
      indiv, group, special, pub, leadershipTotal, extension, innovations, speakership, books, articles, interviewTotal, grandTotal
    };
  }, [data]);

  const isFormValid = useMemo(() => {
    return (
      data.division !== '' && 
      data.schoolName.trim() !== '' && 
      data.candidateName.trim() !== '' &&
      data.movFile !== null
    );
  }, [data.division, data.schoolName, data.candidateName, data.movFile]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("⚠️ File size limit is 15MB. Please optimize your PDF portfolio.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      setData(prev => ({
        ...prev,
        movFile: {
          name: file.name,
          data: base64String,
          mimeType: file.type
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!isFormValid) {
      setShowValidationErrors(true);
      setActiveTab('basic');
      alert("⚠️ Missing Data: Division, School, Candidate Name, and PDF Portfolio are mandatory.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionStep('Preparing Data...');
    
    try {
      await new Promise(r => setTimeout(r, 600));
      setSubmissionStep('Encoding Portfolio...');
      
      const sanitizedName = data.candidateName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const sanitizedSchool = data.schoolName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const finalFileName = `${data.division}_${sanitizedSchool}_${sanitizedName}_OSPA.pdf`;
      
      const payload = {
        timestamp: new Date().toLocaleString(),
        candidateName: data.candidateName,
        division: data.division,
        schoolName: data.schoolName,
        averageRating: averageRating.toFixed(3),
        grandTotal: totals.grandTotal.toFixed(2),
        details: {
          journalism: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2),
          leadership: totals.leadershipTotal.toFixed(2),
          extensions: (totals.extension + totals.innovations + totals.speakership + totals.books + totals.articles).toFixed(2),
          interview: totals.interviewTotal.toFixed(2)
        },
        movFile: data.movFile ? {
          data: data.movFile.data,
          name: finalFileName,
          mimeType: "application/pdf"
        } : null
      };

      setSubmissionStep('Connecting to Google Cloud...');
      
      // We use no-cors because Google Apps Script redirects usually cause CORS errors on regular fetch.
      // However, no-cors means we can't see the response body.
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      
      setSubmissionStep('Verifying Transmission...');
      await new Promise(r => setTimeout(r, 1500));

      alert(`✅ TRANSMISSION COMPLETE!\n\nNominee: ${data.candidateName}\n\nSync initiated with Google Cloud. If the portfolio doesn't appear in your Drive, please ensure:\n1. FOLDER_ID is correct in the script.\n2. You have executed 'authorizeMe' in the Apps Script editor.\n3. The folder has 'Anyone with link can Edit' permissions.`);
      setShowValidationErrors(false);
    } catch (error: any) {
      console.error("Submission Error:", error);
      alert(`❌ UPLOAD FAILED: ${error.message || 'Network error'}\n\nPlease check your SCRIPT_URL and internet connection.`);
    } finally {
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  const addItem = (category: keyof OSPAScoreState, newItem: any) => {
    setData(prev => ({
      ...prev,
      [category]: [...(prev[category] as any[]), { ...newItem, id: Math.random().toString(36).substr(2, 9) }]
    }));
  };

  const removeItem = (category: keyof OSPAScoreState, id: string) => {
    setData(prev => ({
      ...prev,
      [category]: (prev[category] as any[]).filter(item => item.id !== id)
    }));
  };

  const renderSectionHeader = (title: string, icon: string, value: string, color: string) => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
      <div className="flex items-center gap-6">
        <div className={`w-16 h-16 ${color} bg-opacity-20 ${color.replace('bg-', 'text-')} rounded-2xl flex items-center justify-center text-3xl shadow-lg border border-white/5`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <h3 className="text-3xl font-black text-white tracking-tight">{title}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Matrix Evaluation Pillar</p>
        </div>
      </div>
      <div className="glass-card px-8 py-5 rounded-3xl text-right min-w-[200px]">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Component Value</span>
        <span className="text-5xl font-black text-indigo-400 tabular-nums leading-none tracking-tighter">{value}</span>
      </div>
    </div>
  );

  const renderAchievementSection = (title: string, category: keyof OSPAScoreState, ranks: Rank[], levels: Level[]) => {
    const getVal = () => {
      if(category === 'individualContests') return totals.indiv;
      if(category === 'groupContests') return totals.group;
      if(category === 'specialAwards') return totals.special;
      if(category === 'publicationContests') return totals.pub;
      return 0;
    };
    return (
      <div className="glass-card p-10 rounded-[3rem] mb-8 overflow-hidden relative">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
             <span className="w-2 h-7 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"></span>
             {title}
          </h3>
          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            {getVal().toFixed(2)} Points
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 p-8 bg-slate-900/40 rounded-[2rem] border border-white/5">
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-500 uppercase ml-2 tracking-widest">Level</label>
            <select id={`${category}-lvl`} className="w-full p-4 bg-slate-800/80 border border-white/5 rounded-2xl text-[11px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all">
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-500 uppercase ml-2 tracking-widest">Rank</label>
            <select id={`${category}-rnk`} className="w-full p-4 bg-slate-800/80 border border-white/5 rounded-2xl text-[11px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all">
              {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-bold text-slate-500 uppercase ml-2 tracking-widest">Year</label>
            <input id={`${category}-yr`} type="text" placeholder="2024-2025" className="w-full p-4 bg-slate-800/80 border border-white/5 rounded-2xl text-[11px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all" />
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                 const lvl = (document.getElementById(`${category}-lvl`) as HTMLSelectElement).value as Level;
                 const rnk = (document.getElementById(`${category}-rnk`) as HTMLSelectElement).value as Rank;
                 const yr = (document.getElementById(`${category}-yr`) as HTMLInputElement).value;
                 if (yr) {
                   addItem(category, { level: lvl, rank: rnk, year: yr });
                   (document.getElementById(`${category}-yr`) as HTMLInputElement).value = '';
                 } else alert("Input the year for the award.");
              }}
              className="w-full bg-white text-slate-900 p-4.5 rounded-2xl hover:bg-indigo-400 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest shadow-xl neo-button"
            >
              Add Award
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                <th className="py-4 px-2">Level</th>
                <th className="py-4 px-2">Rank</th>
                <th className="py-4 px-2">Year</th>
                <th className="py-4 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data[category] as Achievement[]).map(item => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-5 px-2 text-[11px] font-bold text-slate-200">{item.level}</td>
                  <td className="py-5 px-2 text-[11px] font-bold text-slate-200">{item.rank}</td>
                  <td className="py-5 px-2 text-[11px] font-bold text-slate-200">{item.year}</td>
                  <td className="py-5 px-2 text-right">
                    <button onClick={() => removeItem(category, item.id)} className="w-10 h-10 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <i className="fas fa-trash-can text-sm"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {(data[category] as Achievement[]).length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-slate-500 text-xs italic">Awaiting manual entry of records...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderServiceSection = (title: string, category: keyof OSPAScoreState, levels: Level[]) => {
    const getVal = () => {
      if(category === 'extensionServices') return totals.extension;
      if(category === 'innovations') return totals.innovations;
      if(category === 'speakership') return totals.speakership;
      if(category === 'publishedBooks') return totals.books;
      if(category === 'publishedArticles') return totals.articles;
      return 0;
    };
    return (
      <div className="glass-card p-10 rounded-[3rem] mb-8 overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-3">
             <span className="w-2 h-7 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]"></span>
             {title}
          </h3>
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest">
            {getVal().toFixed(2)} Points
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 p-8 bg-slate-900/40 rounded-[2rem] border border-white/5">
          <div className="md:col-span-2 space-y-2">
            <label className="text-[9px] font-bold text-slate-500 uppercase ml-2 tracking-widest">Level</label>
            <select id={`${category}-slvl`} className="w-full p-4 bg-slate-800/80 border border-white/5 rounded-2xl text-[11px] font-bold text-white outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all">
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                 const lvl = (document.getElementById(`${category}-slvl`) as HTMLSelectElement).value as Level;
                 addItem(category, { level: lvl });
              }}
              className="w-full bg-white text-slate-900 p-4.5 rounded-2xl hover:bg-emerald-400 hover:text-white transition-all font-black text-[10px] uppercase tracking-widest shadow-xl neo-button"
            >
              Log Entry
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-slate-500 text-[9px] font-bold uppercase tracking-widest">
                <th className="py-4 px-2">Level</th>
                <th className="py-4 px-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data[category] as ServiceEntry[]).map(item => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-5 px-2 text-[11px] font-bold text-slate-200">{item.level}</td>
                  <td className="py-5 px-2 text-right">
                    <button onClick={() => removeItem(category, item.id)} className="w-10 h-10 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <i className="fas fa-trash-can text-sm"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {(data[category] as ServiceEntry[]).length === 0 && (
                <tr><td colSpan={2} className="py-12 text-center text-slate-500 text-xs italic">No documented activity logged.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Dynamic Header */}
      <header className="glass-panel sticky top-0 z-[200] h-24 flex items-center px-8 border-b border-white/5">
        <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-white text-xl shadow-2xl shadow-indigo-500/20">
              <i className="fas fa-signature"></i>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-xl font-black text-white tracking-tight uppercase leading-none">OSPA <span className="text-indigo-500">PRO DASHBOARD</span></h1>
              <p className="text-[8px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">Evaluation & Search Excellence Platform</p>
            </div>
          </div>
          
          <div className="flex items-center gap-10">
            <div className="hidden xl:flex items-center gap-10 px-10 border-x border-white/5">
                <div className="text-right">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1">Matrix Grand Total</p>
                  <p className="text-5xl font-black text-indigo-500 tabular-nums leading-none tracking-tighter">{totals.grandTotal.toFixed(2)}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-4">
               <button 
                  onClick={() => setShowInstructions(true)}
                  className="w-12 h-12 rounded-2xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center border border-white/5"
                  title="Config Hub"
                >
                  <i className="fas fa-code-branch"></i>
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className={`relative group px-12 py-4.5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] transition-all flex items-center gap-4 overflow-hidden border border-white/10 ${isSubmitting ? 'bg-slate-800 text-slate-500' : 'bg-white text-slate-900 hover:scale-105 active:scale-95 shadow-2xl shadow-indigo-500/10'}`}
                >
                  {isSubmitting ? <i className="fas fa-atom fa-spin"></i> : <i className="fas fa-cloud-arrow-up"></i>}
                  {isSubmitting ? (submissionStep || 'Processing...') : 'Sync Records'}
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 max-w-[1600px] mx-auto w-full">
        {/* Navigation Sidebar */}
        <aside className="w-80 hidden lg:block p-8 dashboard-sidebar space-y-12 shrink-0">
          <div className="space-y-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 block">Candidate Profile</label>
              <div className="space-y-3">
                 <select 
                   className={`w-full p-4.5 bg-slate-900/50 border rounded-2xl text-[11px] font-bold text-white outline-none transition-all ${showValidationErrors && !data.division ? 'border-red-500/50 ring-2 ring-red-500/10' : 'border-white/5 focus:border-indigo-500/50'}`}
                   value={data.division}
                   onChange={e => setData({...data, division: e.target.value})}
                 >
                   <option value="">Select Division</option>
                   {NCR_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                 </select>
                 <input 
                   type="text" placeholder="Full Official Name" 
                   className={`w-full p-4.5 bg-slate-900/50 border rounded-2xl text-[11px] font-bold text-white outline-none transition-all ${showValidationErrors && !data.candidateName.trim() ? 'border-red-500/50 ring-2 ring-red-500/10' : 'border-white/5 focus:border-indigo-500/50'}`}
                   value={data.candidateName}
                   onChange={e => setData({...data, candidateName: e.target.value})}
                 />
                 <input 
                   type="text" placeholder="Official School Name" 
                   className={`w-full p-4.5 bg-slate-900/50 border rounded-2xl text-[11px] font-bold text-white outline-none transition-all ${showValidationErrors && !data.schoolName.trim() ? 'border-red-500/50 ring-2 ring-red-500/10' : 'border-white/5 focus:border-indigo-500/50'}`}
                   value={data.schoolName}
                   onChange={e => setData({...data, schoolName: e.target.value})}
                 />
              </div>
            </div>

            <div className="space-y-4">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 block">Evidence Pack</label>
               <div className={`relative border-2 border-dashed rounded-[2.5rem] p-8 text-center transition-all cursor-pointer group ${data.movFile ? 'border-emerald-500/50 bg-emerald-500/5' : (showValidationErrors && !data.movFile ? 'border-red-500 animate-pulse' : 'border-white/5 hover:border-indigo-500/50 hover:bg-white/5')}`}>
                  <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} />
                  <div className="space-y-4">
                     <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto transition-all ${data.movFile ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-slate-500 group-hover:scale-110'}`}>
                        <i className={`fas ${data.movFile ? 'fa-check-circle' : 'fa-file-pdf'} text-2xl`}></i>
                     </div>
                     <p className={`text-[9px] font-black uppercase tracking-widest truncate max-w-full ${data.movFile ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {data.movFile ? data.movFile.name : 'Select PDF Portfolio'}
                     </p>
                  </div>
               </div>
            </div>
          </div>

          <nav className="space-y-3 pt-12 border-t border-white/5">
             {[
               { id: 'basic', label: 'Evaluation Matrix', icon: 'fa-table-cells' },
               { id: 'contests', label: 'Journalism Record', icon: 'fa-feather' },
               { id: 'leadership', label: 'Leadership', icon: 'fa-medal' },
               { id: 'services', label: 'Extensions', icon: 'fa-briefcase' },
               { id: 'interview', label: 'Pro Interview', icon: 'fa-headset' }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`w-full flex items-center gap-5 px-8 py-5 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-2xl scale-[1.05] z-10' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
               >
                 <i className={`fas ${tab.icon} w-5 text-center text-sm`}></i>
                 {tab.label}
               </button>
             ))}
          </nav>
        </aside>

        {/* Dynamic Content Section */}
        <section className="flex-1 p-8 lg:p-12 overflow-y-auto no-scrollbar pb-40">
           {activeTab === 'basic' && (
             <div className="space-y-12 animate-in fade-in slide-in-from-bottom duration-500">
               <div className="glass-card p-12 rounded-[3.5rem] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                  
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-10 mb-20">
                    <div className="w-20 h-20 bg-indigo-500 text-white rounded-[2rem] flex items-center justify-center text-4xl shadow-2xl shadow-indigo-500/20">
                      <i className="fas fa-layer-group"></i>
                    </div>
                    <div>
                      <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4">Official Aggregate Matrix</h2>
                      <p className="text-slate-500 text-sm font-medium tracking-wide">Enter the performance ratings for the previous five (5) consecutive school years.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
                    {data.performanceRatings.map((entry) => (
                      <div key={entry.year} className="p-8 glass-card border-white/5 rounded-[2.5rem] group/input transition-all hover:bg-white/10">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6 block">{entry.year}</label>
                        <input 
                          type="number" step="0.001"
                          className="w-full bg-transparent text-5xl font-black text-white outline-none group-focus-within/input:text-indigo-400 transition-colors tabular-nums"
                          value={entry.score}
                          onChange={(e) => {
                             const val = parseFloat(e.target.value) || 0;
                             setData(prev => ({
                               ...prev,
                               performanceRatings: prev.performanceRatings.map(r => r.year === entry.year ? { ...r, score: val } : r)
                             }));
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mt-16 p-12 bg-indigo-600 rounded-[3.5rem] flex flex-col md:flex-row items-center justify-between text-white shadow-3xl shadow-indigo-500/20 relative overflow-hidden">
                    <div className="absolute inset-0 animate-shimmer opacity-20"></div>
                    <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                      <div className="w-24 h-24 bg-white/20 backdrop-blur-xl rounded-[2.5rem] flex items-center justify-center text-5xl border border-white/20">
                        <i className="fas fa-microchip"></i>
                      </div>
                      <div className="text-center md:text-left">
                        <p className="text-[11px] font-bold text-indigo-100 uppercase tracking-[0.4em] mb-3">Master Aggregate Score</p>
                        <p className="text-9xl font-black tabular-nums tracking-tighter leading-none">{averageRating.toFixed(3)}</p>
                      </div>
                    </div>
                    <div className="mt-10 md:mt-0 px-12 py-6 bg-white text-indigo-600 rounded-[2rem] text-[12px] font-black uppercase tracking-[0.2em] shadow-2xl relative z-10">
                      {averageRating >= 4.5 ? 'Distinguished' : (averageRating >= 4.0 ? 'Exemplary' : 'Proficient')}
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                  {[
                    { label: 'Journalism', value: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2), icon: 'fa-feather', color: 'from-amber-400 to-orange-600' },
                    { label: 'Leadership', value: totals.leadershipTotal.toFixed(2), icon: 'fa-medal', color: 'from-indigo-400 to-indigo-600' },
                    { label: 'Extension', value: (totals.extension + totals.innovations + totals.speakership + totals.books + totals.articles).toFixed(2), icon: 'fa-atom', color: 'from-emerald-400 to-emerald-600' },
                    { label: 'Interview', value: totals.interviewTotal.toFixed(2), icon: 'fa-headset', color: 'from-blue-400 to-blue-600' }
                  ].map((stat, i) => (
                    <div key={i} className="glass-card p-10 rounded-[3rem] group">
                      <div className={`w-16 h-16 bg-gradient-to-tr ${stat.color} rounded-2xl flex items-center justify-center mb-10 text-3xl text-white shadow-xl group-hover:scale-110 transition-all`}>
                        <i className={`fas ${stat.icon}`}></i>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{stat.label}</p>
                      <p className="text-5xl font-black text-white tabular-nums tracking-tighter">{stat.value}</p>
                    </div>
                  ))}
               </div>
             </div>
           )}

           {activeTab === 'contests' && (
             <div className="space-y-6 animate-in slide-in-from-right duration-500">
                {renderAchievementSection('I. Individual Achievement', 'individualContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderAchievementSection('II. Group Category Excellence', 'groupContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderAchievementSection('III. Special Merit Awards', 'specialAwards', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderAchievementSection('IV. Publication Recognition', 'publicationContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
             </div>
           )}

           {activeTab === 'leadership' && (
             <div className="glass-card p-12 rounded-[3.5rem] animate-in zoom-in-95 duration-500">
                {renderSectionHeader('Leadership Portfolio', 'fa-award', totals.leadershipTotal.toFixed(2), 'bg-indigo-500')}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-16 p-10 bg-slate-900/40 rounded-[3rem] border border-white/5">
                   <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Organization Level</label>
                     <select id="lead-lvl" className="w-full p-5 bg-slate-800 border border-white/5 rounded-2xl text-[12px] font-black text-white outline-none ring-offset-4 ring-indigo-500/20 focus:ring-4">
                       <option value={Level.NATIONAL}>National</option>
                       <option value={Level.REGIONAL}>Regional</option>
                       <option value={Level.DIVISION}>Division</option>
                     </select>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-4">Highest Position</label>
                     <select id="lead-pos" className="w-full p-5 bg-slate-800 border border-white/5 rounded-2xl text-[12px] font-black text-white outline-none ring-offset-4 ring-indigo-500/20 focus:ring-4">
                       <option value={Position.PRESIDENT}>President</option>
                       <option value={Position.VICE_PRESIDENT}>Vice President</option>
                       <option value={Position.OTHER}>Other Officer</option>
                     </select>
                  </div>
                  <div className="md:col-span-2 flex items-end">
                     <button 
                       onClick={() => {
                          const lvl = (document.getElementById('lead-lvl') as HTMLSelectElement).value as Level;
                          const rnk = (document.getElementById('lead-pos') as HTMLSelectElement).value as Position;
                          addItem('leadership', { level: lvl, position: rnk });
                       }}
                       className="w-full py-6 bg-white text-slate-900 rounded-3xl font-black text-[12px] uppercase tracking-widest hover:bg-indigo-400 hover:text-white transition-all shadow-2xl neo-button"
                     >
                       Record Leadership Tenure
                     </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.leadership.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-10 glass-card rounded-[3rem] group">
                      <div className="flex items-center gap-8">
                        <div className="w-16 h-16 bg-white/5 text-indigo-400 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-indigo-500 group-hover:text-white transition-all">
                          <i className="fas fa-crown"></i>
                        </div>
                        <div>
                          <p className="font-black text-white text-xl tracking-tight">{item.position}</p>
                          <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-2">{item.level} Level</p>
                        </div>
                      </div>
                      <button onClick={() => removeItem('leadership', item.id)} className="w-14 h-14 flex items-center justify-center text-slate-600 hover:text-red-400 transition-all">
                        <i className="fas fa-times-circle text-3xl"></i>
                      </button>
                    </div>
                  ))}
                  {data.leadership.length === 0 && (
                    <div className="col-span-2 py-24 text-center border-2 border-dashed border-white/5 rounded-[4rem]">
                       <p className="text-slate-600 text-sm font-medium italic">Documented leadership roles will appear here.</p>
                    </div>
                  )}
                </div>
             </div>
           )}

           {activeTab === 'services' && (
             <div className="space-y-8 animate-in slide-in-from-right duration-500">
                {renderServiceSection('V. Extension Services (Facilitator)', 'extensionServices', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderServiceSection('VI. Innovations & Advocacy', 'innovations', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION, Level.DISTRICT, Level.SCHOOL])}
                {renderServiceSection('VII. Resource Speakership', 'speakership', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderServiceSection('VIII. Published Books & Modules', 'publishedBooks', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderServiceSection('IX. Research Publication', 'publishedArticles', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
             </div>
           )}

           {activeTab === 'interview' && (
             <div className="glass-card p-12 rounded-[3.5rem] animate-in zoom-in-95 duration-500">
               {renderSectionHeader('Official Interview', 'fa-headset', totals.interviewTotal.toFixed(2), 'bg-blue-500')}
               <div className="space-y-24 max-w-4xl mx-auto py-16">
                 {[
                   { key: 'principles', label: 'Journalism Ethics & Governance', icon: 'fa-scale-balanced' },
                   { key: 'leadership', label: 'Mentorship & Professional Influence', icon: 'fa-users-rays' },
                   { key: 'engagement', label: 'Stakeholder & Community Integration', icon: 'fa-earth-asia' },
                   { key: 'commitment', label: 'Ethical Integrity & Personal Mission', icon: 'fa-shield-halved' },
                   { key: 'communication', label: 'Verbal & Narrative Articulation', icon: 'fa-comment-dots' }
                 ].map(indicator => (
                   <div key={indicator.key} className="space-y-12 group">
                     <div className="flex justify-between items-end">
                        <div className="flex items-center gap-6">
                           <div className="w-14 h-14 bg-white/5 text-blue-400 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                              <i className={`fas ${indicator.icon}`}></i>
                           </div>
                           <div>
                              <label className="font-black text-white text-[12px] uppercase tracking-widest leading-none">{indicator.label}</label>
                              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-2 italic">Search Indicator 2.4.b</p>
                           </div>
                        </div>
                        <div className="px-10 py-4 bg-blue-600 text-white rounded-3xl text-2xl font-black tabular-nums shadow-2xl shadow-blue-500/30">
                          {data.interview[indicator.key as keyof InterviewScores].toFixed(1)} <span className="text-[11px] text-blue-200 font-bold ml-2">/ 1.0</span>
                        </div>
                     </div>
                     <div className="px-2">
                        <input 
                          type="range" min="0" max="1" step="0.1" 
                          value={data.interview[indicator.key as keyof InterviewScores]}
                          onChange={e => setData({ ...data, interview: { ...data.interview, [indicator.key]: parseFloat(e.target.value) } })}
                          className="w-full"
                        />
                     </div>
                     <div className="flex justify-between text-[9px] font-black text-slate-600 uppercase tracking-[0.3em] px-1">
                        <span>Baseline</span>
                        <span>Exceptional</span>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}
        </section>
      </div>

      {/* Script Setup Overlay */}
      {showInstructions && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-6xl max-h-[85vh] rounded-[4rem] shadow-3xl overflow-hidden flex flex-col border border-white/5">
            <div className="p-12 border-b border-white/5 flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white text-slate-900 rounded-[2rem] flex items-center justify-center text-2xl">
                  <i className="fas fa-code"></i>
                </div>
                <div>
                   <h2 className="text-3xl font-black text-white">Back-end Configuration</h2>
                   <p className="text-slate-500 text-sm font-medium mt-1">Configure your Google Apps Script for automated data logging & storage.</p>
                </div>
              </div>
              <button onClick={() => setShowInstructions(false)} className="w-16 h-16 bg-white/5 rounded-3xl text-slate-500 hover:text-white transition-all flex items-center justify-center">
                <i className="fas fa-times text-2xl"></i>
              </button>
            </div>
            
            <div className="p-12 overflow-y-auto space-y-12 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="p-10 bg-indigo-500/5 border border-indigo-500/10 rounded-[3rem] space-y-6">
                    <h3 className="text-[11px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-3">
                        <i className="fas fa-folder-open"></i> 1. Drive Preparation
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Create a folder in Google Drive. Copy its ID from the URL bar (the text after <code className="text-indigo-300">/folders/</code>). Ensure sharing is set to "Anyone with the link can edit".
                    </p>
                 </div>
                 <div className="p-10 bg-emerald-500/5 border border-emerald-500/10 rounded-[3rem] space-y-6">
                    <h3 className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-3">
                        <i className="fas fa-user-shield"></i> 2. Authorization
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Paste the code below into Apps Script. Select <b>'authorizeMe'</b> and click <b>Run</b>. Complete the Google security dialog (Advanced -&gt; Go to unsafe).
                    </p>
                 </div>
                 <div className="p-10 bg-blue-500/5 border border-blue-500/10 rounded-[3rem] space-y-6">
                    <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-3">
                        <i className="fas fa-rocket"></i> 3. Deployment
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        Click <b>Deploy &gt; New Deployment</b>. Set Type to "Web App", Execute as "Me", and Access to "Anyone". Paste the URL in the <b>SCRIPT_URL</b> variable in App.tsx.
                    </p>
                 </div>
              </div>

              <div className="relative group">
                <div className="absolute top-8 right-8 z-10">
                    <button className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black tracking-widest hover:bg-indigo-400 hover:text-white transition-all shadow-2xl">COPY VERIFIED CODE</button>
                </div>
                <pre className="p-12 bg-black/40 text-indigo-300 text-[12px] rounded-[3rem] overflow-x-auto font-mono leading-relaxed h-[500px] border border-white/5 scrollbar-thin">
{`/** 
 * OSPA AUTOMATED EVALUATION SYNC 
 * INSTRUCTIONS: Update FOLDER_ID and run authorizeMe() once.
 */
var FOLDER_ID = "PASTE_YOUR_DRIVE_FOLDER_ID_HERE"; 

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 1. DATA ENTRY: Append Evaluation Scores
    sheet.appendRow([
      data.timestamp,
      data.division,
      data.schoolName,
      data.candidateName,
      data.averageRating,
      data.details.journalism,
      data.details.leadership,
      data.details.extensions,
      data.details.interview,
      data.grandTotal
    ]);

    // 2. FILE MANAGEMENT: Save Portfolio PDF
    if (data.movFile && data.movFile.data) {
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var bytes = Utilities.base64Decode(data.movFile.data);
      var blob = Utilities.newBlob(bytes, data.movFile.mimeType, data.movFile.name);
      folder.createFile(blob);
    }

    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    Logger.log("Critical Error: " + err.toString());
    return ContentService.createTextOutput("Error: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}

function authorizeMe() {
  // EXECUTE THIS FUNCTION ONCE MANUALLY
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("Authorization Flow Finalized.");
}`}
                </pre>
              </div>
            </div>
            
            <div className="p-10 border-t border-white/5 text-center bg-black/20">
              <button onClick={() => setShowInstructions(false)} className="px-20 py-6 bg-white text-slate-900 rounded-[2rem] font-black text-[12px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl">
                Ready to Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
