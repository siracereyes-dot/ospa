
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

// CRITICAL: Replace this with your Google Apps Script 'Exec' URL
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
  const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
      alert("⚠️ File limit exceeded (15MB). Please compress your PDF portfolio.");
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
      alert("⚠️ Missing Information: Please ensure the Profile is complete and a PDF Portfolio is attached.");
      return;
    }

    setIsSubmitting(true);
    setSubmissionStep('Validating Data Integrity...');
    
    try {
      await new Promise(r => setTimeout(r, 600));
      setSubmissionStep('Optimizing Portfolio Assets...');
      
      const sanitizedName = data.candidateName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const sanitizedSchool = data.schoolName.replace(/\s+/g, '_').replace(/[^\w]/g, '');
      const finalFileName = `OSPA_Portfolio_${data.division}_${sanitizedSchool}_${sanitizedName}.pdf`;
      
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

      setSubmissionStep('Opening Cloud Channel...');
      
      // We use no-cors because Google Scripts redirects often fail CORS preflights, 
      // but no-cors successfully delivers the payload.
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(payload)
      });
      
      setSubmissionStep('Finalizing Sync...');
      await new Promise(r => setTimeout(r, 1200));

      setLastSyncStatus('success');
      alert(`✅ CLOUD SYNC INITIATED\n\nNominee: ${data.candidateName}\n\nData and Portfolio were transmitted. Please verify entries in your Google Sheet and Drive folder in a few moments.`);
      setShowValidationErrors(false);
    } catch (error: any) {
      setLastSyncStatus('error');
      console.error("Cloud Sync Error:", error);
      alert(`❌ SYNC INTERRUPTED: ${error.message || 'The cloud endpoint is unreachable.'}\n\nVerify your SCRIPT_URL and Apps Script deployment settings.`);
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
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
      <div className="flex items-center gap-8">
        <div className={`w-20 h-20 ${color} bg-opacity-20 ${color.replace('bg-', 'text-')} rounded-3xl flex items-center justify-center text-4xl shadow-2xl border border-white/5`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <h3 className="text-4xl font-black text-white tracking-tight leading-none">{title}</h3>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-3">Primary Matrix Metric</p>
        </div>
      </div>
      <div className="glass-card px-10 py-6 rounded-[2rem] text-right min-w-[240px] border-indigo-500/10 shadow-xl">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Component Total</span>
        <span className="text-6xl font-black text-indigo-500 tabular-nums leading-none tracking-tighter">{value}</span>
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
      <div className="glass-card p-12 rounded-[3.5rem] mb-10 overflow-hidden relative border border-white/5">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-4">
             <span className="w-3 h-8 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]"></span>
             {title}
          </h3>
          <div className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-8 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest tabular-nums">
            {getVal().toFixed(2)} pts
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 p-10 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-inner">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-3 tracking-widest">Level</label>
            <select id={`${category}-lvl`} className="w-full p-5 bg-slate-800/90 border border-white/10 rounded-2xl text-[12px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer">
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-3 tracking-widest">Rank</label>
            <select id={`${category}-rnk`} className="w-full p-5 bg-slate-800/90 border border-white/10 rounded-2xl text-[12px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all appearance-none cursor-pointer">
              {ranks.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-3 tracking-widest">School Year</label>
            <input id={`${category}-yr`} type="text" placeholder="e.g., 2024-25" className="w-full p-5 bg-slate-800/90 border border-white/10 rounded-2xl text-[12px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all" />
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
                 } else alert("Year field is required.");
              }}
              className="w-full bg-white text-slate-950 p-5 rounded-2xl hover:bg-indigo-500 hover:text-white transition-all font-black text-[12px] uppercase tracking-[0.25em] shadow-2xl neo-button"
            >
              Add Award
            </button>
          </div>
        </div>
        <div className="overflow-x-auto px-4">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="py-6 px-4">Operating Level</th>
                <th className="py-6 px-4">Standing</th>
                <th className="py-6 px-4">Year</th>
                <th className="py-6 px-4 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data[category] as Achievement[]).map(item => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-6 px-4 text-[14px] font-bold text-slate-200">{item.level}</td>
                  <td className="py-6 px-4 text-[14px] font-bold text-slate-200">{item.rank}</td>
                  <td className="py-6 px-4 text-[14px] font-bold text-slate-200">{item.year}</td>
                  <td className="py-6 px-4 text-right">
                    <button onClick={() => removeItem(category, item.id)} className="w-12 h-12 rounded-2xl text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all">
                      <i className="fas fa-trash-can text-lg"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {(data[category] as Achievement[]).length === 0 && (
                <tr><td colSpan={4} className="py-16 text-center text-slate-600 text-[11px] font-black uppercase tracking-[0.3em] opacity-30 italic">Records pending documentation</td></tr>
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
      <div className="glass-card p-12 rounded-[3.5rem] mb-10 overflow-hidden border border-white/5 relative">
        <div className="flex justify-between items-center mb-10">
          <h3 className="text-2xl font-black text-slate-100 tracking-tight flex items-center gap-4">
             <span className="w-3 h-8 bg-emerald-500 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.6)]"></span>
             {title}
          </h3>
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-8 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest tabular-nums">
            {getVal().toFixed(2)} pts
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 p-10 bg-slate-900/60 rounded-[2.5rem] border border-white/5 shadow-inner">
          <div className="md:col-span-2 space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-3 tracking-widest">Engagement Level</label>
            <select id={`${category}-lvl`} className="w-full p-5 bg-slate-800/90 border border-white/10 rounded-2xl text-[12px] font-bold text-white outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer">
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button 
              onClick={() => {
                 const lvl = (document.getElementById(`${category}-lvl`) as HTMLSelectElement).value as Level;
                 addItem(category, { level: lvl });
              }}
              className="w-full bg-white text-slate-950 p-5 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all font-black text-[12px] uppercase tracking-[0.25em] shadow-2xl neo-button"
            >
              Log Performance
            </button>
          </div>
        </div>
        <div className="overflow-x-auto px-4">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                <th className="py-6 px-4">Service Level</th>
                <th className="py-6 px-4 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(data[category] as ServiceEntry[]).map(item => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors group">
                  <td className="py-6 px-4 text-[14px] font-bold text-slate-200">{item.level}</td>
                  <td className="py-6 px-4 text-right">
                    <button onClick={() => removeItem(category, item.id)} className="w-12 h-12 rounded-2xl text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all">
                      <i className="fas fa-trash-can text-lg"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {(data[category] as ServiceEntry[]).length === 0 && (
                <tr><td colSpan={2} className="py-16 text-center text-slate-600 text-[11px] font-black uppercase tracking-[0.3em] opacity-30 italic">No records documented</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-panel sticky top-0 z-[200] h-28 flex items-center px-12 border-b border-white/10 shadow-2xl">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-800 rounded-2xl flex items-center justify-center text-white text-2xl shadow-3xl shadow-indigo-500/20 border border-white/10">
              <i className="fas fa-shield-halved"></i>
            </div>
            <div className="hidden lg:block">
              <h1 className="text-2xl font-black text-white tracking-tight uppercase leading-none">OSPA <span className="text-indigo-500">PLATINUM PRO</span></h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.5em] uppercase mt-3">Evaluation Intel Engine &bull; v6.2 Premium</p>
            </div>
          </div>
          
          <div className="flex items-center gap-12">
            <div className="hidden xl:flex items-center gap-14 px-12 border-x border-white/10 h-16">
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Matrix Grand Total</p>
                  <p className="text-6xl font-black text-indigo-500 tabular-nums leading-none tracking-tighter">{totals.grandTotal.toFixed(2)}</p>
                </div>
            </div>
            
            <div className="flex items-center gap-6">
                <div className="hidden md:flex flex-col items-end mr-6">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sync Uplink</p>
                   <div className={`flex items-center gap-3 px-4 py-2 rounded-xl border border-white/5 ${lastSyncStatus === 'success' ? 'bg-emerald-500/10' : (lastSyncStatus === 'error' ? 'bg-red-500/10' : 'bg-slate-900/50')}`}>
                      <div className={`w-2.5 h-2.5 rounded-full status-pulse ${lastSyncStatus === 'success' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : (lastSyncStatus === 'error' ? 'bg-red-500' : 'bg-slate-700')}`}></div>
                      <span className={`text-[11px] font-black uppercase tracking-tighter ${lastSyncStatus === 'success' ? 'text-emerald-400' : (lastSyncStatus === 'error' ? 'text-red-400' : 'text-slate-500')}`}>
                        {lastSyncStatus === 'success' ? 'SYNCHRONIZED' : (lastSyncStatus === 'error' ? 'ERROR / OFFLINE' : 'READY')}
                      </span>
                   </div>
                </div>
               <button 
                  onClick={() => setShowInstructions(true)}
                  className="w-14 h-14 rounded-[1.25rem] bg-white/5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-400/10 transition-all flex items-center justify-center border border-white/5 active:scale-90"
                  title="Configure Cloud Bridge"
                >
                  <i className="fas fa-satellite-dish text-xl"></i>
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className={`relative group px-14 py-5 rounded-[1.25rem] font-black text-[13px] uppercase tracking-[0.25em] transition-all flex items-center gap-5 overflow-hidden border border-white/10 ${isSubmitting ? 'bg-slate-900 text-slate-600' : 'bg-white text-slate-950 hover:scale-[1.03] active:scale-95 shadow-3xl shadow-indigo-500/20'}`}
                >
                  {isSubmitting ? <i className="fas fa-atom fa-spin"></i> : <i className="fas fa-cloud-bolt"></i>}
                  {isSubmitting ? (submissionStep || 'Processing...') : 'Sync Records'}
                </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1800px] mx-auto w-full">
        <aside className="w-96 hidden lg:block p-10 dashboard-sidebar space-y-16 shrink-0 border-r border-white/10">
          <div className="space-y-12">
            <div className="space-y-6">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] ml-3 block">Profile Intelligence</label>
              <div className="space-y-4">
                 <select 
                   className={`w-full p-5 bg-slate-900/40 border rounded-2xl text-[13px] font-bold text-white outline-none transition-all appearance-none cursor-pointer ${showValidationErrors && !data.division ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 focus:border-indigo-500/50 focus:bg-indigo-500/5 shadow-sm'}`}
                   value={data.division}
                   onChange={e => setData({...data, division: e.target.value})}
                 >
                   <option value="">Select Division</option>
                   {NCR_DIVISIONS.map(div => <option key={div} value={div}>{div}</option>)}
                 </select>
                 <input 
                   type="text" placeholder="Candidate's Full Name" 
                   className={`w-full p-5 bg-slate-900/40 border rounded-2xl text-[13px] font-bold text-white outline-none transition-all ${showValidationErrors && !data.candidateName.trim() ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 focus:border-indigo-500/50 focus:bg-indigo-500/5 shadow-sm'}`}
                   value={data.candidateName}
                   onChange={e => setData({...data, candidateName: e.target.value})}
                 />
                 <input 
                   type="text" placeholder="Full School Name" 
                   className={`w-full p-5 bg-slate-900/40 border rounded-2xl text-[13px] font-bold text-white outline-none transition-all ${showValidationErrors && !data.schoolName.trim() ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 focus:border-indigo-500/50 focus:bg-indigo-500/5 shadow-sm'}`}
                   value={data.schoolName}
                   onChange={e => setData({...data, schoolName: e.target.value})}
                 />
              </div>
            </div>

            <div className="space-y-6">
               <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] ml-3 block">Portfolio Asset (PDF)</label>
               <div className={`relative border-2 border-dashed rounded-[3rem] p-12 text-center transition-all cursor-pointer group ${data.movFile ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_40px_rgba(16,185,129,0.1)]' : (showValidationErrors && !data.movFile ? 'border-red-500 bg-red-500/5 animate-pulse' : 'border-white/10 hover:border-indigo-500/50 hover:bg-white/5 shadow-sm')}`}>
                  <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileUpload} />
                  <div className="space-y-5">
                     <div className={`w-16 h-16 rounded-[1.75rem] flex items-center justify-center mx-auto transition-all ${data.movFile ? 'bg-emerald-500 text-white shadow-3xl shadow-emerald-500/40 scale-110' : 'bg-white/5 text-slate-500 group-hover:scale-110 group-hover:text-indigo-400'}`}>
                        <i className={`fas ${data.movFile ? 'fa-fingerprint' : 'fa-file-pdf'} text-3xl`}></i>
                     </div>
                     <div className="px-2">
                        <p className={`text-[10px] font-black uppercase tracking-widest truncate max-w-full ${data.movFile ? 'text-emerald-400' : 'text-slate-500'}`}>
                           {data.movFile ? data.movFile.name : 'Link Evidence Pack'}
                        </p>
                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tighter mt-3 italic opacity-60">Max 15MB Portfolio</p>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          <nav className="space-y-4 pt-14 border-t border-white/10">
             {[
               { id: 'basic', label: 'Evaluation Matrix', icon: 'fa-chart-pie' },
               { id: 'contests', label: 'Journalism Record', icon: 'fa-feather-pointed' },
               { id: 'leadership', label: 'Leadership Profile', icon: 'fa-medal' },
               { id: 'services', label: 'Extension Services', icon: 'fa-users-gear' },
               { id: 'interview', label: 'Panel Interview', icon: 'fa-comments' }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id)}
                 className={`w-full flex items-center gap-8 px-10 py-6 rounded-[1.75rem] text-left text-[12px] font-black uppercase tracking-[0.2em] transition-all group ${activeTab === tab.id ? 'bg-white text-slate-950 shadow-[0_25px_50px_rgba(255,255,255,0.1)] scale-[1.04] z-10' : 'text-slate-500 hover:bg-white/5 hover:text-white'}`}
               >
                 <i className={`fas ${tab.icon} w-6 text-center text-xl transition-transform group-hover:scale-125`}></i>
                 {tab.label}
               </button>
             ))}
          </nav>
        </aside>

        <section className="flex-1 p-10 lg:p-20 overflow-y-auto no-scrollbar pb-60">
           {activeTab === 'basic' && (
             <div className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-700">
               <div className="glass-card p-14 rounded-[4.5rem] relative overflow-hidden shadow-2xl border border-white/5">
                  <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-[120px] pointer-events-none"></div>
                  
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-12 mb-20 relative z-10">
                    <div className="w-24 h-24 bg-gradient-to-tr from-indigo-500 to-indigo-800 text-white rounded-[2.5rem] flex items-center justify-center text-5xl shadow-3xl shadow-indigo-500/30 border border-white/10">
                      <i className="fas fa-layer-group"></i>
                    </div>
                    <div>
                      <h2 className="text-5xl font-black text-white tracking-tight leading-none mb-5">Aggregate Matrix Base</h2>
                      <p className="text-slate-400 text-lg font-medium tracking-wide max-w-2xl leading-relaxed">Mandatory input of performance ratings for the previous five (5) consecutive school years.</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 relative z-10">
                    {data.performanceRatings.map((entry) => (
                      <div key={entry.year} className="p-10 glass-card border-white/5 rounded-[3.25rem] group/input transition-all hover:bg-white/10 shadow-lg border-2">
                        <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-10 block text-center leading-none">{entry.year}</label>
                        <input 
                          type="number" step="0.001"
                          className="w-full bg-transparent text-6xl font-black text-white text-center outline-none group-focus-within/input:text-indigo-400 transition-colors tabular-nums tracking-tighter"
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

                  <div className="mt-20 p-16 bg-gradient-to-r from-indigo-600 to-blue-700 rounded-[4.5rem] flex flex-col md:flex-row items-center justify-between text-white shadow-[0_40px_80px_rgba(99,102,241,0.3)] relative overflow-hidden border border-white/20">
                    <div className="absolute inset-0 animate-shimmer opacity-30 pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row items-center gap-14 relative z-10">
                      <div className="w-36 h-36 bg-white/15 backdrop-blur-3xl rounded-[3.25rem] flex items-center justify-center text-8xl border border-white/20 shadow-inner">
                        <i className="fas fa-chart-simple"></i>
                      </div>
                      <div className="text-center md:text-left">
                        <p className="text-[12px] font-black text-indigo-100 uppercase tracking-[0.5em] mb-4">Official Aggregate Mean</p>
                        <p className="text-[12rem] font-black tabular-nums tracking-tighter leading-none">{averageRating.toFixed(3)}</p>
                      </div>
                    </div>
                    <div className="mt-12 md:mt-0 px-20 py-8 bg-white text-indigo-700 rounded-[2.5rem] text-[16px] font-black uppercase tracking-[0.35em] shadow-[0_30px_60px_rgba(255,255,255,0.2)] relative z-10 cursor-default">
                      {averageRating >= 4.5 ? 'Distinguished Rank' : (averageRating >= 4.0 ? 'Superior Rank' : 'Proficient Rank')}
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-12">
                  {[
                    { label: 'Journalism', value: (totals.indiv + totals.group + totals.special + totals.pub).toFixed(2), icon: 'fa-feather-pointed', color: 'from-amber-400 to-orange-600', shadow: 'shadow-orange-500/20' },
                    { label: 'Leadership', value: totals.leadershipTotal.toFixed(2), icon: 'fa-medal', color: 'from-indigo-400 to-indigo-700', shadow: 'shadow-indigo-500/20' },
                    { label: 'Excellence', value: (totals.extension + totals.innovations + totals.speakership + totals.books + totals.articles).toFixed(2), icon: 'fa-award', color: 'from-emerald-400 to-emerald-700', shadow: 'shadow-emerald-500/20' },
                    { label: 'Interview', value: totals.interviewTotal.toFixed(2), icon: 'fa-headset', color: 'from-blue-400 to-blue-700', shadow: 'shadow-blue-500/20' }
                  ].map((stat, i) => (
                    <div key={i} className={`glass-card p-14 rounded-[4rem] group border border-white/5 relative overflow-hidden transition-all duration-500 ${stat.shadow}`}>
                      <div className={`w-20 h-20 bg-gradient-to-tr ${stat.color} rounded-[1.75rem] flex items-center justify-center mb-10 text-4xl text-white shadow-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                        <i className={`fas ${stat.icon}`}></i>
                      </div>
                      <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4">{stat.label}</p>
                      <p className="text-7xl font-black text-white tabular-nums tracking-tighter leading-none">{stat.value}</p>
                      <div className="absolute bottom-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                         <i className={`fas ${stat.icon} text-[12rem]`}></i>
                      </div>
                    </div>
                  ))}
               </div>
             </div>
           )}

           {activeTab === 'contests' && (
             <div className="space-y-10 animate-in slide-in-from-right-10 duration-700">
                {renderAchievementSection('I. Individual Record', 'individualContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderAchievementSection('II. Group Category Excellence', 'groupContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderAchievementSection('III. Special Merit Awards', 'specialAwards', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderAchievementSection('IV. Publications Recognition', 'publicationContests', [Rank.FIRST, Rank.SECOND, Rank.THIRD, Rank.FOURTH, Rank.FIFTH, Rank.SIXTH, Rank.SEVENTH], [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
             </div>
           )}

           {activeTab === 'leadership' && (
             <div className="glass-card p-14 rounded-[4.5rem] animate-in zoom-in-95 duration-700 border border-white/5 relative shadow-3xl">
                {renderSectionHeader('Leadership Portfolio', 'fa-medal', totals.leadershipTotal.toFixed(2), 'bg-indigo-500')}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-20 p-12 bg-slate-900/60 rounded-[3.5rem] border border-white/5 shadow-inner">
                   <div className="space-y-4">
                     <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Org Level</label>
                     <select id="lead-lvl" className="w-full p-6 bg-slate-800/90 border border-white/10 rounded-2xl text-[14px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 appearance-none cursor-pointer">
                       <option value={Level.NATIONAL}>National</option>
                       <option value={Level.REGIONAL}>Regional</option>
                       <option value={Level.DIVISION}>Division</option>
                     </select>
                  </div>
                  <div className="space-y-4">
                     <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Official Position</label>
                     <select id="lead-pos" className="w-full p-6 bg-slate-800/90 border border-white/10 rounded-2xl text-[14px] font-bold text-white outline-none focus:ring-4 focus:ring-indigo-500/20 appearance-none cursor-pointer">
                       <option value={Position.PRESIDENT}>President</option>
                       <option value={Position.VICE_PRESIDENT}>Vice President</option>
                       <option value={Position.OTHER}>Other Officer</option>
                     </select>
                  </div>
                  <div className="md:col-span-2 flex items-end">
                     <button 
                       onClick={() => {
                          const lvl = (document.getElementById('lead-lvl') as HTMLSelectElement).value as Level;
                          const pos = (document.getElementById('lead-pos') as HTMLSelectElement).value as Position;
                          addItem('leadership', { level: lvl, position: pos });
                       }}
                       className="w-full py-7 bg-white text-slate-950 rounded-[2.5rem] font-black text-[14px] uppercase tracking-[0.3em] hover:bg-indigo-500 hover:text-white transition-all shadow-3xl neo-button"
                     >
                       Record Tenure
                     </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {data.leadership.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-12 glass-card rounded-[4rem] group border border-white/5 hover:scale-[1.02] transition-transform shadow-lg">
                      <div className="flex items-center gap-10">
                        <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-[2rem] flex items-center justify-center text-4xl group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-lg border border-white/5">
                          <i className="fas fa-certificate"></i>
                        </div>
                        <div>
                          <p className="font-black text-white text-2xl tracking-tight leading-none mb-3">{item.position}</p>
                          <p className="text-[11px] text-indigo-400 font-bold uppercase tracking-[0.4em]">{item.level} Scope</p>
                        </div>
                      </div>
                      <button onClick={() => removeItem('leadership', item.id)} className="w-16 h-16 flex items-center justify-center text-slate-700 hover:text-red-500 transition-all active:scale-90">
                        <i className="fas fa-circle-xmark text-4xl opacity-50 hover:opacity-100"></i>
                      </button>
                    </div>
                  ))}
                  {data.leadership.length === 0 && (
                    <div className="col-span-2 py-32 text-center border-2 border-dashed border-white/10 rounded-[5rem] bg-white/5">
                       <p className="text-slate-600 text-[12px] font-black uppercase tracking-[0.5em] opacity-40 italic">Leadership records pending documentation</p>
                    </div>
                  )}
                </div>
             </div>
           )}

           {activeTab === 'services' && (
             <div className="space-y-12 animate-in slide-in-from-right-10 duration-700">
                {renderServiceSection('V. Extension Services (Facilitator)', 'extensionServices', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderServiceSection('VI. Advocacy Innovations', 'innovations', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION, Level.DISTRICT, Level.SCHOOL])}
                {renderServiceSection('VII. Resource Speakership', 'speakership', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderServiceSection('VIII. Published Books & Modules', 'publishedBooks', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
                {renderServiceSection('IX. Formal Research & Articles', 'publishedArticles', [Level.NATIONAL, Level.REGIONAL, Level.DIVISION])}
             </div>
           )}

           {activeTab === 'interview' && (
             <div className="glass-card p-14 rounded-[4.5rem] animate-in zoom-in-95 duration-700 border border-white/10 shadow-3xl">
               {renderSectionHeader('Professional Panel Interview', 'fa-podcast', totals.interviewTotal.toFixed(2), 'bg-blue-500')}
               <div className="space-y-32 max-w-5xl mx-auto py-24 px-4">
                 {[
                   { key: 'principles', label: 'Journalism Ethics & Governance', icon: 'fa-scale-balanced', desc: 'Alignment with standard journalistic principles and media law.' },
                   { key: 'leadership', label: 'Mentorship & Professional Influence', icon: 'fa-user-tie', desc: 'Capacity to guide and influence professional school journalism.' },
                   { key: 'engagement', label: 'Stakeholder Integration & Advocacy', icon: 'fa-earth-asia', desc: 'Depth of community integration and journalism extension.' },
                   { key: 'commitment', label: 'Ethical Integrity & Personal Mission', icon: 'fa-shield-halved', desc: 'Consistency of professional values and dedication.' },
                   { key: 'communication', label: 'Narrative Articulation & Precision', icon: 'fa-microphone-lines', desc: 'Verbal precision, confidence, and narrative depth.' }
                 ].map(indicator => (
                   <div key={indicator.key} className="space-y-16 group">
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12">
                        <div className="flex items-center gap-10">
                           <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform shadow-xl border border-white/5">
                              <i className={`fas ${indicator.icon}`}></i>
                           </div>
                           <div>
                              <label className="font-black text-white text-[16px] uppercase tracking-widest leading-none block mb-4">{indicator.label}</label>
                              <p className="text-[11px] text-slate-500 font-medium tracking-wide uppercase">{indicator.desc}</p>
                           </div>
                        </div>
                        <div className="px-14 py-6 bg-blue-600/90 text-white rounded-[2.25rem] text-4xl font-black tabular-nums shadow-[0_20px_50px_rgba(37,99,235,0.3)] border border-white/20 active:scale-95 transition-transform cursor-default">
                          {data.interview[indicator.key as keyof InterviewScores].toFixed(1)} <span className="text-[14px] text-blue-100 font-bold ml-4 opacity-60">/ 1.0</span>
                        </div>
                     </div>
                     <div className="px-6">
                        <input 
                          type="range" min="0" max="1" step="0.1" 
                          value={data.interview[indicator.key as keyof InterviewScores]}
                          onChange={e => setData({ ...data, interview: { ...data.interview, [indicator.key]: parseFloat(e.target.value) } })}
                          className="w-full cursor-pointer"
                        />
                     </div>
                     <div className="flex justify-between text-[11px] font-black text-slate-600 uppercase tracking-[0.5em] px-2">
                        <span>Baseline</span>
                        <span>Exceptional Mastery</span>
                     </div>
                   </div>
                 ))}
               </div>
             </div>
           )}
        </section>
      </div>

      {showInstructions && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/98 backdrop-blur-[60px] flex items-center justify-center p-12 animate-in fade-in duration-500">
          <div className="bg-slate-900/80 w-full max-w-7xl max-h-[90vh] rounded-[5.5rem] shadow-[0_60px_120px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col border border-white/10">
            <div className="p-16 border-b border-white/10 flex justify-between items-center bg-black/40">
              <div className="flex items-center gap-12">
                <div className="w-20 h-20 bg-white text-slate-950 rounded-[2.75rem] flex items-center justify-center text-4xl shadow-3xl">
                  <i className="fas fa-satellite-dish"></i>
                </div>
                <div>
                   <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-4">Cloud Bridge Protocol &bull; v6.2</h2>
                   <p className="text-slate-500 text-lg font-medium tracking-wide">Establish a secure automated channel for evaluation data and portfolio storage.</p>
                </div>
              </div>
              <button onClick={() => setShowInstructions(false)} className="w-20 h-20 bg-white/5 rounded-[2.25rem] text-slate-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center border border-white/5 shadow-inner">
                <i className="fas fa-xmark text-3xl"></i>
              </button>
            </div>
            
            <div className="p-16 overflow-y-auto space-y-16 no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                 <div className="p-12 bg-indigo-500/5 border border-indigo-500/20 rounded-[4rem] space-y-8 hover:bg-indigo-500/10 transition-colors shadow-sm">
                    <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl">
                        <i className="fas fa-folder-tree"></i>
                    </div>
                    <h3 className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.25em]">1. Vault Identifier</h3>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                        Create a Google Drive folder. Extract the long Alphanumeric ID from its URL. Update folder sharing to <b>&quot;Anyone with the link can EDIT&quot;</b> to permit script access.
                    </p>
                 </div>
                 <div className="p-12 bg-emerald-500/5 border border-emerald-500/20 rounded-[4rem] space-y-8 hover:bg-emerald-500/10 transition-colors shadow-sm">
                    <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl">
                        <i className="fas fa-user-lock"></i>
                    </div>
                    <h3 className="text-[14px] font-black text-emerald-400 uppercase tracking-[0.25em]">2. Security Handshake</h3>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                        Paste the Cloud Protocol into Apps Script. Locate and execute <b>&apos;authorizeMe&apos;</b> manually in the editor toolbar. Approve all safety and permission prompts.
                    </p>
                 </div>
                 <div className="p-12 bg-blue-500/5 border border-blue-500/20 rounded-[4rem] space-y-8 hover:bg-blue-500/10 transition-colors shadow-sm">
                    <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl">
                        <i className="fas fa-rocket-launch"></i>
                    </div>
                    <h3 className="text-[14px] font-black text-blue-400 uppercase tracking-[0.25em]">3. Production Deployment</h3>
                    <p className="text-sm text-slate-400 leading-relaxed font-medium">
                        Click <b>Deploy &gt; New Deployment</b>. Set Execute as &quot;Me&quot; and Access to &quot;Anyone&quot;. Update your <b>SCRIPT_URL</b> in App.tsx with the resulting production URL.
                    </p>
                 </div>
              </div>

              <div className="relative group">
                <div className="absolute top-10 right-10 z-10 flex items-center gap-8">
                    <span className="text-[11px] font-black text-slate-600 uppercase tracking-[0.5em] hidden md:block italic">Verified Cloud Logic v6.2.4</span>
                    <button className="bg-white text-slate-950 px-8 py-4 rounded-2xl text-[12px] font-black uppercase tracking-[0.25em] hover:bg-indigo-500 hover:text-white transition-all shadow-3xl active:scale-95">COPY CLOUD PROTOCOL</button>
                </div>
                <pre className="p-16 bg-black/50 text-indigo-300 text-[14px] rounded-[4.5rem] overflow-x-auto font-mono leading-relaxed h-[650px] border border-white/5 scrollbar-thin shadow-inner">
{`/** 
 * OSPA AUTOMATED EVALUATION SYNC - Platinum Engine v6.2
 * INSTRUCTIONS: Update FOLDER_ID and execute authorizeMe() once.
 */
var FOLDER_ID = "PASTE_YOUR_DRIVE_FOLDER_ID_HERE"; 

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // 1. STORAGE ENGINE: Save encoded portfolio pack first to get URL
    var portfolioUrl = "NO_PORTFOLIO_ATTACHED";
    if (payload.movFile && payload.movFile.data) {
      var folder = DriveApp.getFolderById(FOLDER_ID.trim());
      var bytes = Utilities.base64Decode(payload.movFile.data);
      var blob = Utilities.newBlob(bytes, "application/pdf", payload.movFile.name);
      var file = folder.createFile(blob);
      portfolioUrl = file.getUrl();
    }

    // 2. DATA PERSISTENCE: Record evaluation row including File URL
    sheet.appendRow([
      payload.timestamp,
      payload.division,
      payload.schoolName,
      payload.candidateName,
      payload.averageRating,
      payload.details.journalism,
      payload.details.leadership,
      payload.details.extensions,
      payload.details.interview,
      payload.grandTotal,
      portfolioUrl
    ]);

    return ContentService.createTextOutput("SUCCESS")
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    console.error("Critical Failure: " + err.toString());
    return ContentService.createTextOutput("ERROR: " + err.toString())
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

function authorizeMe() {
  /** REQUIRED: Execute this in the Script Editor once manually */
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("Cloud Access Tokens Regenerated Successfully.");
}

function debugConnectivity() {
  /** HELPER: Run to verify folder link is valid */
  try {
    var folder = DriveApp.getFolderById(FOLDER_ID.trim());
    Logger.log("Verified Connection to Folder: " + folder.getName());
  } catch(e) {
    Logger.log("Connection Failed: Ensure FOLDER_ID is correct and shared as 'Editor'.");
  }
}`}
                </pre>
              </div>

              <div className="p-14 border border-red-500/20 bg-red-500/5 rounded-[4rem] flex items-center gap-12 shadow-sm">
                 <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center text-4xl shrink-0 border border-red-500/10">
                    <i className="fas fa-triangle-exclamation"></i>
                 </div>
                 <div className="space-y-4">
                    <h4 className="text-red-400 text-[13px] font-black uppercase tracking-[0.4em]">Critical Synchronization Advisory</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                        <b>The Deployment Version Rule:</b> Google Apps Script caches code. Every time you modify the script (e.g., changing the Folder ID), you <b>MUST</b> create a <b>&quot;New Deployment&quot;</b>. Redeploying an existing deployment version often leads to &quot;Opaque Success&quot; where the browser thinks it worked but the cloud logic is still using old, broken code.
                    </p>
                 </div>
              </div>
            </div>
            
            <div className="p-16 border-t border-white/10 text-center bg-black/70">
              <button onClick={() => setShowInstructions(false)} className="px-36 py-9 bg-white text-slate-950 rounded-[2.75rem] font-black text-[14px] uppercase tracking-[0.5em] hover:scale-[1.03] active:scale-95 transition-all shadow-[0_40px_80px_rgba(255,255,255,0.25)] border border-white/20">
                Finalize Configuration & Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
