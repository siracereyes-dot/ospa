
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
  MOVFile,
  NominationType,
  AcademicRank,
  PublicationPosition
} from './types';
import { SCORING_RUBRIC } from './constants';

const NCR_DIVISIONS = [
  "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila",
  "Marikina", "Muntinlupa", "Navotas", "Parañaque", "Pasay", "Pasig",
  "Quezon City", "San Juan", "Taguig City and Pateros (TAPAT)", "Valenzuela"
];

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyar3ji86tD3WubBdAq8aR_zFp-gkzhcyYFtayBuTdFZpoCxpZmyR-7B5Wpbg_9M20D/exec";

const INITIAL_STATE: OSPAScoreState = {
  nominationType: NominationType.JOURNALIST,
  candidateName: '',
  division: '',
  schoolName: '',
  movFile: null,
  academicRank: AcademicRank.NONE,
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
  pubPosition: PublicationPosition.WRITER,
  leadership: [],
  extensionServices: [],
  innovations: [],
  publishedWorks: [],
  trainingsAttended: [],
  interview: {
    principles: 0,
    leadership: 0,
    engagement: 0,
    commitment: 0,
    communication: 0
  },
  speakership: [],
  publishedBooks: [],
  publishedArticles: []
};

const App: React.FC = () => {
  const [data, setData] = useState<OSPAScoreState>(INITIAL_STATE);
  const [activeTab, setActiveTab] = useState<string>('mode');
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
    if (data.nominationType === NominationType.ADVISER) {
      // ADVISER WEIGHTED CALCULATION
      const rub = SCORING_RUBRIC.ADVISER;
      const calcAch = (items: Achievement[], rubric: any) => {
        let total = 0;
        Object.values(Level).forEach(lvl => {
          const levelItems = items.filter(i => i.level === lvl);
          const levelRubric = rubric[lvl];
          if (!levelRubric) return;
          let levelPoints = 0;
          levelItems.forEach(item => { levelPoints += (levelRubric[item.rank] || 0); });
          total += levelPoints * (levelRubric.weight || 0);
        });
        return total;
      };
      const calcSec = (items: ServiceEntry[], rubric: any) => {
        let totalPoints = 0;
        items.forEach(item => { totalPoints += (rubric[item.level] || 0); });
        return totalPoints * (rubric.weight || 1);
      };

      const indiv = calcAch(data.individualContests, rub.INDIVIDUAL);
      const group = calcAch(data.groupContests, rub.GROUP);
      const special = calcAch(data.specialAwards, rub.SPECIAL_AWARDS);
      const pub = calcAch(data.publicationContests, rub.PUBLICATION);
      
      const leadLvls = { [Level.NATIONAL]: 0, [Level.REGIONAL]: 0, [Level.DIVISION]: 0 };
      data.leadership.forEach(e => {
        const pts = (rub.LEADERSHIP as any)[e.level]?.[e.position] || 0;
        if (pts > leadLvls[e.level as keyof typeof leadLvls]) leadLvls[e.level as keyof typeof leadLvls] = pts;
      });
      const lead = Object.values(leadLvls).reduce((a, b) => a + b, 0) * rub.LEADERSHIP.weight;

      const ext = calcSec(data.extensionServices, rub.EXTENSION);
      const inn = calcSec(data.innovations, rub.INNOVATIONS);
      const spk = calcSec(data.speakership, rub.SPEAKERSHIP);
      const bks = calcSec(data.publishedBooks, rub.BOOKS);
      const art = calcSec(data.publishedArticles, rub.ARTICLES);
      const int = (Object.values(data.interview) as number[]).reduce((a, b) => a + b, 0) * 2;

      return { academic: 0, journalism: indiv + group + special + pub, lead, excel: ext + inn + spk + bks + art, interview: int, grandTotal: (indiv + group + special + pub + lead + ext + inn + spk + bks + art + int) };
    } else {
      // JOURNALIST ACCUMULATED CALCULATION
      const rub = SCORING_RUBRIC.JOURNALIST;
      const academic = rub.ACADEMIC[data.academicRank] || 0;
      
      const calcAch = (items: Achievement[], rubric: any) => {
        let total = 0;
        items.forEach(item => { total += (rubric[item.level]?.[item.rank] || 0); });
        return total;
      };
      const calcSec = (items: ServiceEntry[], rubric: any) => {
        let total = 0;
        items.forEach(item => { total += (rubric[item.level] || 0); });
        return total;
      };

      const indiv = calcAch(data.individualContests, rub.INDIVIDUAL);
      const group = calcAch(data.groupContests, rub.GROUP);
      const special = calcAch(data.specialAwards, rub.SPECIAL_AWARDS);
      
      const pubPosPts = rub.PUB_POSITION[data.pubPosition] || 0;
      const guildLvls = { [Level.NATIONAL]: 0, [Level.REGIONAL]: 0, [Level.DIVISION]: 0 };
      data.leadership.forEach(e => {
        const pts = (rub.GUILD_LEADERSHIP as any)[e.level]?.[e.position] || 0;
        if (pts > guildLvls[e.level as keyof typeof guildLvls]) guildLvls[e.level as keyof typeof guildLvls] = pts;
      });
      const guildLead = Object.values(guildLvls).reduce((a, b) => a + b, 0);
      const innovations = calcSec(data.innovations, rub.INNOVATIONS);
      
      const community = calcSec(data.extensionServices, rub.COMMUNITY);
      const published = calcSec(data.publishedWorks, rub.PUBLISHED_WORKS);
      const trainings = calcSec(data.trainingsAttended, rub.TRAININGS);
      const interview = (Object.values(data.interview) as number[]).reduce((a, b) => a + b, 0) * 2;

      const grandTotal = academic + indiv + group + special + pubPosPts + guildLead + innovations + community + published + trainings + interview;

      return { academic, journalism: indiv + group + special, lead: pubPosPts + guildLead + innovations, excel: community + published + trainings, interview, grandTotal };
    }
  }, [data]);

  const handleSave = async () => {
    if (!data.candidateName || !data.division || !data.movFile) {
      alert("Please complete Profile and upload PDF Portfolio before syncing.");
      return;
    }
    setIsSubmitting(true);
    setSubmissionStep('Transmitting to Cloud...');
    try {
      const payload = {
        timestamp: new Date().toLocaleString(),
        type: data.nominationType,
        candidateName: data.candidateName,
        division: data.division,
        schoolName: data.schoolName,
        grandTotal: totals.grandTotal.toFixed(2),
        academic: totals.academic.toFixed(2),
        journalism: totals.journalism.toFixed(2),
        leadership: totals.lead.toFixed(2),
        excellence: totals.excel.toFixed(2),
        interview: totals.interview.toFixed(2),
        movFile: data.movFile
      };
      await fetch(SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
      setLastSyncStatus('success');
      alert("✅ Sync Success: Evaluation records stored in cloud database.");
    } catch (e) {
      setLastSyncStatus('error');
      alert("❌ Sync Failed: Check connectivity or Script URL.");
    } finally {
      setIsSubmitting(false);
      setSubmissionStep('');
    }
  };

  const addItem = (category: keyof OSPAScoreState, newItem: any) => {
    setData(prev => ({ ...prev, [category]: [...(prev[category] as any[]), { ...newItem, id: Math.random().toString(36).substr(2, 9) }] }));
  };

  const removeItem = (category: keyof OSPAScoreState, id: string) => {
    setData(prev => ({ ...prev, [category]: (prev[category] as any[]).filter(item => item.id !== id) }));
  };

  const renderSectionHeader = (title: string, icon: string, value: string, color: string) => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
      <div className="flex items-center gap-8">
        <div className={`w-20 h-20 ${color} bg-opacity-20 ${color.replace('bg-', 'text-')} rounded-3xl flex items-center justify-center text-4xl shadow-2xl border border-white/5`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <h3 className="text-4xl font-black text-white tracking-tight leading-none">{title}</h3>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-3">Active Assessment Category</p>
        </div>
      </div>
      <div className="glass-card px-10 py-6 rounded-[2rem] text-right min-w-[240px] border-indigo-500/10 shadow-xl">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Running Subtotal</span>
        <span className="text-6xl font-black text-indigo-500 tabular-nums leading-none tracking-tighter">{value}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-panel sticky top-0 z-[200] h-28 flex items-center px-12 border-b border-white/10">
        <div className="max-w-[1800px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-800 rounded-2xl flex items-center justify-center text-white text-2xl border border-white/10">
              <i className="fas fa-microscope"></i>
            </div>
            <div>
              <h1 className="text-2xl font-black text-white uppercase tracking-tight">OSPA-OCJ <span className="text-indigo-500">EXPRESS</span></h1>
              <p className="text-[10px] text-slate-500 font-bold tracking-[0.5em] uppercase">DepEd NCR Official Matrix v2026</p>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aggregate Standing</p>
              <p className="text-5xl font-black text-indigo-500 tracking-tighter tabular-nums">{totals.grandTotal.toFixed(2)}</p>
            </div>
            <button onClick={handleSave} disabled={isSubmitting} className="bg-white text-slate-950 px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">
              {isSubmitting ? 'SYNCING...' : 'SYNC RECORDS'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1800px] mx-auto w-full">
        <aside className="w-96 hidden lg:block p-10 dashboard-sidebar space-y-12 shrink-0 border-r border-white/10">
          <div className="space-y-4">
             <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] ml-3">Selection Mode</label>
             <button onClick={() => setActiveTab('mode')} className={`w-full p-6 rounded-2xl text-[12px] font-black uppercase tracking-widest text-left border border-white/5 transition-all ${activeTab === 'mode' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                <i className="fas fa-shuffle mr-4"></i> Switch Mode
             </button>
          </div>

          <div className="space-y-4">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] ml-3">Profile Identity</label>
            <div className="space-y-4">
               <select className="w-full p-5 bg-slate-900 border border-white/10 rounded-2xl text-[13px] font-bold text-white" value={data.division} onChange={e => setData({...data, division: e.target.value})}>
                 <option value="">Division...</option>
                 {NCR_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
               </select>
               <input type="text" placeholder="Candidate Name" className="w-full p-5 bg-slate-900 border border-white/10 rounded-2xl text-[13px] font-bold text-white" value={data.candidateName} onChange={e => setData({...data, candidateName: e.target.value})} />
               <input type="text" placeholder="School Name" className="w-full p-5 bg-slate-900 border border-white/10 rounded-2xl text-[13px] font-bold text-white" value={data.schoolName} onChange={e => setData({...data, schoolName: e.target.value})} />
            </div>
          </div>

          <div className="space-y-4 pt-10 border-t border-white/10">
             <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] ml-3">Navigation</label>
             <nav className="space-y-3">
               {[
                 { id: 'academic', label: 'Academic Standing', icon: 'fa-graduation-cap' },
                 { id: 'contests', label: 'Journalism Record', icon: 'fa-feather-pointed' },
                 { id: 'leadership', label: 'Leadership Profile', icon: 'fa-medal' },
                 { id: 'excellence', label: 'Excellence Points', icon: 'fa-award' },
                 { id: 'interview', label: 'Panel Interview', icon: 'fa-comments' }
               ].map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-6 px-8 py-5 rounded-2xl text-left text-[12px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-slate-950 scale-105' : 'text-slate-500 hover:text-white'}`}>
                   <i className={`fas ${tab.icon} w-5`}></i> {tab.label}
                 </button>
               ))}
             </nav>
          </div>
        </aside>

        <main className="flex-1 p-10 lg:p-20 overflow-y-auto">
           {activeTab === 'mode' && (
             <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-4">
                  <h2 className="text-4xl font-black text-white">Award Category Selection</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest">Select the relevant matrix for evaluation</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   {[NominationType.JOURNALIST, NominationType.ADVISER].map(type => (
                     <button key={type} onClick={() => { setData({...data, nominationType: type}); setActiveTab('academic'); }} className={`p-16 rounded-[4rem] text-center space-y-8 border-2 transition-all hover:scale-105 ${data.nominationType === type ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5 opacity-50'}`}>
                        <div className={`w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-5xl ${data.nominationType === type ? 'bg-indigo-500 text-white' : 'bg-white/10 text-slate-500'}`}>
                           <i className={`fas ${type === NominationType.JOURNALIST ? 'fa-user-pen' : 'fa-chalkboard-user'}`}></i>
                        </div>
                        <h3 className="text-2xl font-black text-white">{type}</h3>
                        <p className="text-slate-500 text-xs font-bold leading-relaxed">{type === NominationType.JOURNALIST ? 'Criteria for elementary/secondary campus journalists based on Annex I.' : 'Criteria for secondary school paper advisers based on Annex J.'}</p>
                     </button>
                   ))}
                </div>
             </div>
           )}

           {activeTab === 'academic' && (
             <div className="space-y-16 animate-in slide-in-from-bottom-10">
               {data.nominationType === NominationType.JOURNALIST ? (
                 <div className="glass-card p-14 rounded-[4rem] border border-white/5">
                   {renderSectionHeader('Academic Standing', 'fa-graduation-cap', totals.academic.toFixed(2), 'bg-amber-500')}
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {Object.values(AcademicRank).map(r => (
                        <button key={r} onClick={() => setData({...data, academicRank: r})} className={`p-10 rounded-3xl border-2 transition-all text-left space-y-4 ${data.academicRank === r ? 'border-amber-500 bg-amber-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                           <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Category</span>
                           <p className="text-xl font-black text-white">{r}</p>
                           <p className="text-amber-500 font-black tabular-nums">{SCORING_RUBRIC.JOURNALIST.ACADEMIC[r]} Points</p>
                        </button>
                      ))}
                   </div>
                 </div>
               ) : (
                 <div className="glass-card p-14 rounded-[4rem] border border-white/5">
                   {renderSectionHeader('Performance Ratings', 'fa-chart-line', averageRating.toFixed(3), 'bg-indigo-500')}
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
                      {data.performanceRatings.map((e, i) => (
                        <div key={i} className="p-8 bg-white/5 rounded-3xl text-center space-y-4 border border-white/5">
                           <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{e.year}</label>
                           <input type="number" step="0.1" className="w-full bg-transparent text-4xl font-black text-white text-center outline-none" value={e.score} onChange={ev => {
                              const ratings = [...data.performanceRatings];
                              ratings[i].score = parseFloat(ev.target.value) || 0;
                              setData({...data, performanceRatings: ratings});
                           }} />
                        </div>
                      ))}
                   </div>
                 </div>
               )}
             </div>
           )}

           {activeTab === 'contests' && (
             <div className="space-y-12 animate-in slide-in-from-right-10">
               {renderSectionHeader('Journalism Achievements', 'fa-feather-pointed', totals.journalism.toFixed(2), 'bg-emerald-500')}
               <div className="grid grid-cols-1 gap-12">
                  {/* Reuse existing Achievement render logic for Indiv, Group, Special... */}
                  <div className="p-12 glass-card rounded-[3rem] border border-white/5 space-y-10">
                     <h3 className="text-2xl font-black text-white flex items-center gap-4"><span className="w-2 h-6 bg-emerald-500 rounded-full"></span> Award Entry</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        <select id="con-cat" className="p-5 bg-slate-900 border border-white/10 rounded-2xl text-sm font-bold text-white"><option value="individualContests">Individual</option><option value="groupContests">Group</option><option value="specialAwards">Special</option></select>
                        <select id="con-lvl" className="p-5 bg-slate-900 border border-white/10 rounded-2xl text-sm font-bold text-white">{Object.values(Level).slice(0,3).map(l => <option key={l} value={l}>{l}</option>)}</select>
                        <select id="con-rnk" className="p-5 bg-slate-900 border border-white/10 rounded-2xl text-sm font-bold text-white">{Object.values(Rank).slice(0,5).map(r => <option key={r} value={r}>{r}</option>)}</select>
                        <button onClick={() => {
                           const cat = (document.getElementById('con-cat') as HTMLSelectElement).value as any;
                           const lvl = (document.getElementById('con-lvl') as HTMLSelectElement).value as Level;
                           const rnk = (document.getElementById('con-rnk') as HTMLSelectElement).value as Rank;
                           addItem(cat, { level: lvl, rank: rnk, year: '2025' });
                        }} className="bg-white text-slate-950 font-black uppercase text-xs p-5 rounded-2xl">Add Entry</button>
                     </div>
                  </div>
               </div>
             </div>
           )}

           {activeTab === 'leadership' && (
             <div className="space-y-12 animate-in zoom-in-95">
               {renderSectionHeader('Leadership Profile', 'fa-medal', totals.lead.toFixed(2), 'bg-indigo-500')}
               {data.nominationType === NominationType.JOURNALIST && (
                 <div className="p-12 glass-card rounded-[3rem] border border-white/5 space-y-10">
                    <h3 className="text-xl font-black text-white">Publication Role</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {Object.values(PublicationPosition).map(p => (
                         <button key={p} onClick={() => setData({...data, pubPosition: p})} className={`p-6 rounded-2xl border-2 transition-all text-left ${data.pubPosition === p ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5'}`}>
                            <p className="text-sm font-black text-white">{p}</p>
                            <p className="text-indigo-400 font-bold text-xs">{SCORING_RUBRIC.JOURNALIST.PUB_POSITION[p]} pts</p>
                         </button>
                       ))}
                    </div>
                 </div>
               )}
               {/* Add Guild Leadership logic here */}
             </div>
           )}

           {activeTab === 'excellence' && (
              <div className="space-y-12 animate-in slide-in-from-right-10">
                {renderSectionHeader('Excellence & Extensions', 'fa-award', totals.excel.toFixed(2), 'bg-blue-500')}
                {/* Dynamic list for extension services, innovations, trainings... */}
              </div>
           )}

           {activeTab === 'interview' && (
             <div className="glass-card p-14 rounded-[4rem] animate-in zoom-in-95 border border-white/5">
                {renderSectionHeader('Panel Interview', 'fa-podcast', totals.interview.toFixed(2), 'bg-blue-500')}
                <div className="space-y-16 max-w-4xl mx-auto py-12">
                  {['principles', 'leadership', 'engagement', 'commitment', 'communication'].map(key => (
                    <div key={key} className="space-y-8">
                       <div className="flex justify-between items-end">
                          <label className="text-sm font-black text-white uppercase tracking-widest">{key}</label>
                          <span className="text-4xl font-black text-blue-500 tabular-nums">{data.interview[key as keyof InterviewScores].toFixed(1)}</span>
                       </div>
                       <input type="range" min="0" max="1" step="0.1" value={data.interview[key as keyof InterviewScores]} onChange={e => setData({...data, interview: {...data.interview, [key]: parseFloat(e.target.value)}})} className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-blue-500" />
                    </div>
                  ))}
                </div>
             </div>
           )}
        </main>
      </div>
    </div>
  );
};

export default App;
