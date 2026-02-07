
import React, { useState, useMemo, useRef } from 'react';
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

// Provided URL for the Google Sheet & Drive integration (Apps Script)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyar3ji86tD3WubBdAq8aR_zFp-gkzhcyYFtayBuTdFZpoCxpZmyR-7B5Wpbg_9M20D/exec";

const INITIAL_STATE: OSPAScoreState = {
  nominationType: NominationType.JOURNALIST,
  candidateName: '',
  division: '',
  schoolName: '',
  movFile: null,
  academicRank: AcademicRank.NONE,
  performanceRatings: [
    { year: '2024-2025', score: 4.5 },
    { year: '2023-2024', score: 4.5 },
    { year: '2022-2023', score: 4.5 },
    { year: '2021-2022', score: 4.5 },
    { year: '2020-2021', score: 4.5 },
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const averageRating = useMemo(() => {
    const sum = data.performanceRatings.reduce((acc, curr) => acc + curr.score, 0);
    return sum / data.performanceRatings.length;
  }, [data.performanceRatings]);

  const totals = useMemo(() => {
    if (data.nominationType === NominationType.ADVISER) {
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

      return { 
        academic: 0, 
        journalism: indiv + group + special + pub, 
        lead, 
        excel: ext + inn + spk + bks + art, 
        interview: int, 
        grandTotal: (indiv + group + special + pub + lead + ext + inn + spk + bks + art + int) 
      };
    } else {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Please upload a PDF file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      // Renaming to Division_school_name.pdf
      const cleanSchool = data.schoolName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const cleanDivision = data.division.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const newName = `${cleanDivision}_${cleanSchool}.pdf`;

      setData(prev => ({
        ...prev,
        movFile: {
          name: newName,
          data: base64,
          mimeType: file.type
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!data.candidateName || !data.division || !data.schoolName) {
      alert("Please complete the candidate profile (Name, Division, School).");
      return;
    }
    if (!data.movFile) {
      alert("Please upload the Consolidated MOVs (PDF) before syncing.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        action: "submit_ospa",
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
        fileData: data.movFile.data,
        fileName: data.movFile.name,
        mimeType: data.movFile.mimeType
      };

      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify(payload)
      });

      alert(`✅ Success! Evaluation for ${data.candidateName} has been synced to the database and Drive folder.`);
    } catch (e) {
      console.error(e);
      alert("❌ Sync Failed. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
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
        <div className={`w-16 h-16 ${color} bg-opacity-20 ${color.replace('bg-', 'text-')} rounded-2xl flex items-center justify-center text-3xl shadow-lg`}>
          <i className={`fas ${icon}`}></i>
        </div>
        <div>
          <h3 className="text-3xl font-black text-white leading-tight">{title}</h3>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">Section Evaluation Matrix</p>
        </div>
      </div>
      <div className="glass-card px-8 py-4 rounded-3xl text-right min-w-[200px] border-indigo-500/20">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Points</span>
        <span className="text-5xl font-black text-indigo-400 tabular-nums tracking-tighter">{value}</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass-panel sticky top-0 z-[200] h-24 flex items-center px-10 border-b border-white/10">
        <div className="max-w-[1600px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl">
              <i className="fas fa-file-invoice"></i>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-black text-white uppercase tracking-tighter">NCR <span className="text-indigo-400">Scorer</span></h1>
              <p className="text-[9px] text-slate-500 font-bold tracking-[0.3em] uppercase">DepEd Matrix v2026</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Grand Score</p>
              <p className="text-4xl font-black text-indigo-400 tabular-nums leading-none">{totals.grandTotal.toFixed(2)}</p>
            </div>
            <button 
              onClick={handleSave} 
              disabled={isSubmitting} 
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-black uppercase text-xs tracking-widest transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Syncing...' : 'Sync to Cloud'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1600px] mx-auto w-full">
        <aside className="w-80 hidden lg:block p-8 dashboard-sidebar space-y-8 shrink-0">
          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">App Mode</label>
             <button onClick={() => setActiveTab('mode')} className={`w-full p-5 rounded-xl text-[11px] font-black uppercase tracking-widest text-left transition-all ${activeTab === 'mode' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                <i className="fas fa-rotate mr-3"></i> Switch Category
             </button>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Profile</label>
            <div className="space-y-3">
               <select className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none" value={data.division} onChange={e => setData({...data, division: e.target.value})}>
                 <option value="">Select Division...</option>
                 {NCR_DIVISIONS.map(d => <option key={d} value={d}>{d}</option>)}
               </select>
               <input type="text" placeholder="Candidate Name" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none" value={data.candidateName} onChange={e => setData({...data, candidateName: e.target.value})} />
               <input type="text" placeholder="School Name" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none" value={data.schoolName} onChange={e => setData({...data, schoolName: e.target.value})} />
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-white/10">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Consolidated MOVs</label>
            <div className={`p-4 rounded-xl border-2 border-dashed transition-all cursor-pointer ${data.movFile ? 'border-emerald-500 bg-emerald-500/5' : 'border-white/10 hover:border-indigo-500'}`} onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} hidden accept=".pdf" onChange={handleFileUpload} />
              <div className="text-center py-2">
                <i className={`fas ${data.movFile ? 'fa-check-circle text-emerald-500' : 'fa-cloud-arrow-up text-slate-500'} text-2xl mb-2`}></i>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{data.movFile ? data.movFile.name : 'Upload PDF Portfolio'}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-6 border-t border-white/10">
             <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2">Criteria Sections</label>
             <nav className="space-y-1">
               {[
                 { id: 'academic', label: 'Academic / Mean', icon: 'fa-graduation-cap' },
                 { id: 'contests', label: 'Journalism Record', icon: 'fa-feather-pointed' },
                 { id: 'leadership', label: 'Leadership Profile', icon: 'fa-award' },
                 { id: 'excellence', label: 'Excellence Points', icon: 'fa-star' },
                 { id: 'interview', label: 'Panel Interview', icon: 'fa-comments' }
               ].map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl text-left text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-slate-500 hover:text-white'}`}>
                   <i className={`fas ${tab.icon} w-4`}></i> {tab.label}
                 </button>
               ))}
             </nav>
          </div>
        </aside>

        <main className="flex-1 p-8 lg:p-12 overflow-y-auto bg-slate-950/20">
           {activeTab === 'mode' && (
             <div className="max-w-3xl mx-auto space-y-12 py-10">
                <div className="text-center space-y-3">
                  <h2 className="text-4xl font-black text-white tracking-tight">Search Selection</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Choose the appropriate evaluation matrix</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {[NominationType.JOURNALIST, NominationType.ADVISER].map(type => (
                     <button key={type} onClick={() => { setData({...data, nominationType: type}); setActiveTab('academic'); }} className={`p-10 rounded-[3rem] text-center space-y-6 border-2 transition-all group ${data.nominationType === type ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5 opacity-50 hover:opacity-100'}`}>
                        <div className={`w-20 h-20 rounded-2xl mx-auto flex items-center justify-center text-4xl transition-all ${data.nominationType === type ? 'bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.3)]' : 'bg-white/10 text-slate-500 group-hover:bg-white/20'}`}>
                           <i className={`fas ${type === NominationType.JOURNALIST ? 'fa-pen-fancy' : 'fa-chalkboard-user'}`}></i>
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">{type}</h3>
                        <p className="text-slate-500 text-[10px] font-bold leading-relaxed px-4">Evaluation criteria defined by Regional Memorandum No. 048 s. 2026.</p>
                     </button>
                   ))}
                </div>
             </div>
           )}

           {activeTab === 'academic' && (
             <div className="max-w-4xl mx-auto space-y-10">
               {data.nominationType === NominationType.JOURNALIST ? (
                 <div className="space-y-8">
                   {renderSectionHeader('Academic Standing', 'fa-graduation-cap', totals.academic.toFixed(2), 'bg-amber-500')}
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.values(AcademicRank).map(r => (
                        <button key={r} onClick={() => setData({...data, academicRank: r})} className={`p-8 rounded-2xl border-2 transition-all text-left space-y-3 ${data.academicRank === r ? 'border-amber-500 bg-amber-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}>
                           <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Rank</span>
                           <p className="text-lg font-black text-white">{r}</p>
                           <p className="text-amber-500 font-black text-xl">{SCORING_RUBRIC.JOURNALIST.ACADEMIC[r]} pts</p>
                        </button>
                      ))}
                   </div>
                 </div>
               ) : (
                 <div className="space-y-8">
                   {renderSectionHeader('Performance Ratings', 'fa-chart-line', averageRating.toFixed(3), 'bg-indigo-500')}
                   <p className="text-xs text-slate-400 font-bold uppercase mb-4 tracking-wider">Average of the past 5 school years</p>
                   <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {data.performanceRatings.map((e, i) => (
                        <div key={i} className="p-6 bg-white/5 rounded-2xl text-center space-y-2 border border-white/5">
                           <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{e.year}</label>
                           <input type="number" step="0.1" className="w-full bg-transparent text-3xl font-black text-white text-center outline-none" value={e.score} onChange={ev => {
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
             <div className="max-w-4xl mx-auto space-y-10">
               {renderSectionHeader('Journalism Contests', 'fa-feather-pointed', totals.journalism.toFixed(2), 'bg-emerald-500')}
               
               <div className="p-8 glass-card rounded-3xl border border-white/5 space-y-6">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3"><span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span> Log New Win</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Type</label>
                      <select id="con-cat" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        <option value="individualContests">Individual</option>
                        <option value="groupContests">Group</option>
                        <option value="specialAwards">Special Awards</option>
                        {data.nominationType === NominationType.ADVISER && <option value="publicationContests">Publication</option>}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Level</label>
                      <select id="con-lvl" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        {Object.values(Level).slice(0,3).map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Place / Rank</label>
                      <select id="con-rnk" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        {Object.values(Rank).slice(0,7).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={() => {
                     const cat = (document.getElementById('con-cat') as HTMLSelectElement).value as any;
                     const lvl = (document.getElementById('con-lvl') as HTMLSelectElement).value as Level;
                     const rnk = (document.getElementById('con-rnk') as HTMLSelectElement).value as Rank;
                     addItem(cat, { level: lvl, rank: rnk, year: '2025' });
                  }} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase text-[10px] tracking-widest p-4 rounded-xl transition-all">Add Achievement</button>
               </div>

               <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Records</h4>
                 {[
                   { id: 'individualContests', label: 'Individual' },
                   { id: 'groupContests', label: 'Group' },
                   { id: 'specialAwards', label: 'Special' },
                   { id: 'publicationContests', label: 'Publication' }
                 ].map(cat => {
                   const items = data[cat.id as keyof OSPAScoreState] as Achievement[];
                   if (!items?.length) return null;
                   return (
                     <div key={cat.id} className="space-y-2">
                       <label className="text-[9px] font-bold text-slate-600 uppercase ml-2">{cat.label}</label>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {items.map(item => (
                           <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10">
                             <div>
                               <p className="text-xs font-black text-white">{item.level} - {item.rank}</p>
                               <p className="text-[9px] text-slate-500 font-bold">{item.year}</p>
                             </div>
                             <button onClick={() => removeItem(cat.id as any, item.id)} className="text-slate-600 hover:text-red-400 p-2 transition-colors">
                               <i className="fas fa-trash-can text-sm"></i>
                             </button>
                           </div>
                         ))}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </div>
           )}

           {activeTab === 'leadership' && (
             <div className="max-w-4xl mx-auto space-y-10">
               {renderSectionHeader('Leadership & Roles', 'fa-award', totals.lead.toFixed(2), 'bg-indigo-500')}
               
               {data.nominationType === NominationType.JOURNALIST && (
                 <div className="space-y-6">
                    <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Publication Position</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {Object.values(PublicationPosition).map(p => (
                         <button key={p} onClick={() => setData({...data, pubPosition: p})} className={`p-6 rounded-2xl border-2 transition-all text-left ${data.pubPosition === p ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5'}`}>
                            <p className="text-xs font-black text-white">{p}</p>
                            <p className="text-indigo-400 font-bold text-[10px] mt-1">{SCORING_RUBRIC.JOURNALIST.PUB_POSITION[p]} Points</p>
                         </button>
                       ))}
                    </div>
                 </div>
               )}

               <div className="p-8 glass-card rounded-3xl border border-white/5 space-y-6">
                 <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3"><span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span> Add Guild Leadership</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Position</label>
                      <select id="lead-pos" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        {Object.values(Position).map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Level</label>
                      <select id="lead-lvl" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        {[Level.NATIONAL, Level.REGIONAL, Level.DIVISION].map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button onClick={() => {
                         const pos = (document.getElementById('lead-pos') as HTMLSelectElement).value as Position;
                         const lvl = (document.getElementById('lead-lvl') as HTMLSelectElement).value as Level;
                         addItem('leadership', { position: pos, level: lvl });
                      }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase text-[10px] tracking-widest p-4 rounded-xl transition-all">Add Rank</button>
                    </div>
                 </div>
               </div>

               {data.leadership.length > 0 && (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {data.leadership.map(item => (
                     <div key={item.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                        <div>
                          <p className="text-xs font-black text-white">{item.position}</p>
                          <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">{item.level}</p>
                        </div>
                        <button onClick={() => removeItem('leadership', item.id)} className="text-slate-600 hover:text-red-400 p-2">
                           <i className="fas fa-trash-can text-sm"></i>
                        </button>
                     </div>
                   ))}
                 </div>
               )}
             </div>
           )}

           {activeTab === 'excellence' && (
             <div className="max-w-4xl mx-auto space-y-10">
               {renderSectionHeader('Excellence & Community', 'fa-star', totals.excel.toFixed(2), 'bg-blue-500')}
               
               <div className="p-8 glass-card rounded-3xl border border-white/5 space-y-6">
                 <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3"><span className="w-1.5 h-4 bg-blue-500 rounded-full"></span> Log Performance Entry</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Category</label>
                      <select id="exc-cat" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        <option value="innovations">Innovations & Advocacies</option>
                        <option value="extensionServices">Extension/Community</option>
                        {data.nominationType === NominationType.ADVISER ? (
                          <>
                            <option value="speakership">Speakership</option>
                            <option value="publishedBooks">Published Books/Modules</option>
                            <option value="publishedArticles">Published Articles</option>
                          </>
                        ) : (
                          <>
                            <option value="publishedWorks">Published Works</option>
                            <option value="trainingsAttended">Journalism Trainings</option>
                          </>
                        )}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Level</label>
                      <select id="exc-lvl" className="w-full p-4 bg-slate-900 border border-white/10 rounded-xl text-xs font-bold text-white outline-none">
                        {Object.values(Level).map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                    </div>
                 </div>
                 <button onClick={() => {
                    const cat = (document.getElementById('exc-cat') as HTMLSelectElement).value as any;
                    const lvl = (document.getElementById('exc-lvl') as HTMLSelectElement).value as Level;
                    addItem(cat, { level: lvl });
                 }} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-[10px] tracking-widest p-4 rounded-xl transition-all">Add to Record</button>
               </div>

               {/* Add list view for excellence records here... */}
             </div>
           )}

           {activeTab === 'interview' && (
             <div className="max-w-3xl mx-auto py-10">
                {renderSectionHeader('Selection Interview', 'fa-comments', totals.interview.toFixed(2), 'bg-purple-500')}
                <div className="space-y-12 py-8">
                  {[
                    { key: 'principles', label: 'Journalism Principles & Ethics' },
                    { key: 'leadership', label: 'Leadership / Mentorship Potential' },
                    { key: 'engagement', label: 'Experience & Engagement' },
                    { key: 'commitment', label: 'Commitment to Growth' },
                    { key: 'communication', label: 'Communication Skills' }
                  ].map(item => (
                    <div key={item.key} className="space-y-6">
                       <div className="flex justify-between items-end">
                          <label className="text-[11px] font-black text-white uppercase tracking-widest leading-none">{item.label}</label>
                          <span className="text-4xl font-black text-purple-400 tabular-nums leading-none">{data.interview[item.key as keyof InterviewScores].toFixed(1)}</span>
                       </div>
                       <input 
                         type="range" 
                         min="0" 
                         max="1" 
                         step="0.1" 
                         value={data.interview[item.key as keyof InterviewScores]} 
                         onChange={e => setData({...data, interview: {...data.interview, [item.key]: parseFloat(e.target.value)}})} 
                         className="w-full h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer accent-purple-500" 
                       />
                       <div className="flex justify-between text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                         <span>Insufficient (0)</span>
                         <span>Limited (0.5)</span>
                         <span>Excellent (1.0)</span>
                       </div>
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
