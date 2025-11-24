import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, CheckCircle2, Circle, Trash2, Calendar, Clock, Tag, Layout, 
  Focus, List as ListIcon, Zap, Filter, AlertCircle, Coffee, ArrowRight, 
  Sun, Moon, X, Flame, Trophy, Pencil, Archive, Infinity as InfinityIcon 
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, onAuthStateChanged, signInAnonymously 
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, 
  onSnapshot, serverTimestamp, orderBy, setDoc, writeBatch 
} from 'firebase/firestore';

// --- YOUR SPECIFIC FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyAcWBlVBxoTkAk0Fv9RcSfrfz8ywdcCi0M",
  authDomain: "zenflow-fd172.firebaseapp.com",
  projectId: "zenflow-fd172",
  storageBucket: "zenflow-fd172.firebasestorage.app",
  messagingSenderId: "7515953682",
  appId: "1:7515953682:web:ac946b05a66d02b3fa96cb",
  measurementId: "G-JD5W8HZ299"
};

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'zenflow-final'; 

// --- PARTICLE CLASS (Moved outside to fix linting) ---
class Particle {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.reset();
  }

  reset() {
    this.x = Math.random() * this.canvasWidth;
    this.y = Math.random() * this.canvasHeight;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = (Math.random() - 0.5) * 2;
    this.size = Math.random() * 3 + 1;
    this.color = ['#6366f1', '#8b5cf6', '#d946ef', '#ffffff'][Math.floor(Math.random() * 4)];
    this.friction = 0.95;
    this.baseSpeed = 2;
  }

  update(isMouseDown, mouseX, mouseY) {
    if (isMouseDown) {
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const force = (1000 / (distance + 10)) * 0.5;
      
      this.vx += (dx / distance) * force;
      this.vy += (dy / distance) * force;
      this.friction = 0.92;
    } else {
      if (Math.abs(this.vx) > this.baseSpeed || Math.abs(this.vy) > this.baseSpeed) {
         this.friction = 0.90;
      } else {
         this.friction = 1;
         this.vx += (Math.random() - 0.5) * 0.2;
         this.vy += (Math.random() - 0.5) * 0.2;
         const speed = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
         if (speed > this.baseSpeed) {
           this.vx = (this.vx / speed) * this.baseSpeed;
           this.vy = (this.vy / speed) * this.baseSpeed;
         }
      }
    }

    this.vx *= this.friction;
    this.vy *= this.friction;
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0) this.x = this.canvasWidth;
    if (this.x > this.canvasWidth) this.x = 0;
    if (this.y < 0) this.y = this.canvasHeight;
    if (this.y > this.canvasHeight) this.y = 0;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
  }
}

// --- APP LOGIC ---
const calculatePriorityScore = (task) => {
  let score = 0;
  const priorityWeights = { high: 50, medium: 25, low: 10 };
  score += priorityWeights[task.priority] || 0;

  if (task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = (due - today) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) score += 100; 
    else if (diffDays === 0) score += 75; 
    else if (diffDays <= 2) score += 40; 
    else if (diffDays <= 7) score += 15; 
  } else { 
    score -= 5; 
  }
  return score;
};

// --- COMPONENTS ---
const ConfettiExplosion = () => {
  const [particles] = useState(() => 
    Array.from({ length: 30 }).map(() => ({
      angle: Math.random() * 360,
      velocity: 100 + Math.random() * 200,
      delay: Math.random() * 0.2,
      color: ['#6366f1', '#a855f7', '#ec4899', '#10b981', '#f59e0b'][Math.floor(Math.random() * 5)]
    }))
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-50 flex items-center justify-center">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-explode opacity-0"
          style={{
            backgroundColor: p.color,
            transform: `rotate(${p.angle}deg) translate(0px)`,
            '--angle': `${p.angle}deg`,
            '--velocity': `${p.velocity}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: '1s',
            animationFillMode: 'forwards'
          }} 
        />
      ))}
      <style>{`
        @keyframes explode {
          0% { opacity: 1; transform: rotate(var(--angle)) translate(0px); }
          100% { opacity: 0; transform: rotate(var(--angle)) translate(var(--velocity)); }
        }
        .animate-explode { animation-name: explode; }
      `}</style>
    </div>
  );
};

const ZenSingularity = ({ isOpen, onClose }) => {
  const canvasRef = useRef(null);
  const [isPressing, setIsPressing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let particles = [];
    const particleCount = 150;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    let mouseX = canvas.width / 2;
    let mouseY = canvas.height / 2;
    let isMouseDown = false;

    const handleMouseDown = () => { isMouseDown = true; setIsPressing(true); };
    const handleMouseUp = () => { isMouseDown = false; setIsPressing(false); };
    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseDown);
    window.addEventListener('touchend', handleMouseUp);

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle(canvas.width, canvas.height));
    }

    const animate = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.update(isMouseDown, mouseX, mouseY);
        p.draw(ctx);
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseDown);
      window.removeEventListener('touchend', handleMouseUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black cursor-crosshair animate-in fade-in duration-500">
      <canvas ref={canvasRef} className="block" />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <div className={`transition-all duration-500 text-center ${isPressing ? 'scale-90 opacity-50 blur-sm' : 'scale-100 opacity-100'}`}>
          <h2 className="text-4xl font-bold text-white tracking-tight mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            The Singularity
          </h2>
          <p className="text-indigo-300 text-sm uppercase tracking-[0.3em]">
            Hold to Gather &bull; Release to Clear
          </p>
        </div>
      </div>
      <button 
        onClick={onClose}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-2 border border-white/10 bg-black/50 backdrop-blur-md rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all text-xs uppercase tracking-widest pointer-events-auto"
      >
        Exit Void
      </button>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[80] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id}
          className={`pointer-events-auto flex items-center justify-between p-4 rounded-xl shadow-2xl transform transition-all duration-500 animate-in slide-in-from-bottom-10 fade-in border backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
            toast.type === 'error' ? 'bg-red-950/90 text-red-100 border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)]' : 
            'bg-neutral-900/90 text-white border-neutral-700 shadow-[0_0_20px_rgba(0,0,0,0.5)]'
          }`}
        >
          <div className="flex items-center gap-3">
            {toast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
            {toast.type === 'error' && <AlertCircle size={18} className="text-red-400" />}
            <span className="text-sm font-medium tracking-wide">{toast.message}</span>
          </div>
          <button onClick={() => removeToast(toast.id)} className="ml-4 text-white/50 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

const TaskItem = ({ task, onToggle, onDelete, onEdit, index }) => {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date().setHours(0,0,0,0) && !task.completed;
  
  return (
    <div 
      style={{ animationDelay: `${index * 0.05}s` }}
      className={`group relative bg-white dark:bg-black p-4 rounded-xl border shadow-sm hover:shadow-lg dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all duration-300 flex items-start gap-3 animate-in slide-in-from-bottom-4 fade-in fill-mode-backwards ${
      isOverdue 
        ? 'border-red-200 bg-red-50/30 dark:border-red-900 dark:bg-red-950/10' 
        : 'border-slate-100 dark:border-neutral-900'
    }`}>
      <button 
        onClick={() => onToggle(task.id, !task.completed)}
        className={`mt-1 flex-shrink-0 transition-all duration-300 active:scale-75 ${
          task.completed ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-300 hover:text-indigo-500 dark:text-neutral-700 dark:hover:text-indigo-400'
        }`}
      >
        {task.completed ? <CheckCircle2 size={24} className="fill-emerald-50 dark:fill-emerald-950" /> : <Circle size={24} />}
      </button>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className={`font-medium truncate transition-all duration-300 ${
            task.completed ? 'line-through text-slate-400 dark:text-neutral-700' : 'text-slate-800 dark:text-neutral-100'
          }`}>
            {task.title}
          </h3>
          {isOverdue && !task.completed && (
            <span className="text-[10px] font-bold text-red-600 bg-red-100 dark:bg-red-950 dark:text-red-400 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900 animate-pulse">OVERDUE</span>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
            task.priority === 'high' ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900" :
            task.priority === 'medium' ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900" :
            "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900"
          }`}>
            {task.priority}
          </span>
          
          {task.duration && (
            <span className="flex items-center text-xs text-slate-500 dark:text-neutral-500 bg-slate-100 dark:bg-neutral-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-neutral-800">
              <Clock size={10} className="mr-1" />
              {task.duration}
            </span>
          )}
          
          {task.category && (
            <span className="flex items-center text-xs text-slate-400 dark:text-neutral-600 border border-transparent dark:border-neutral-900 px-1.5 py-0.5 rounded">
              <Tag size={10} className="mr-1" />
              {task.category}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => onEdit(task)}
          className="p-2 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 dark:text-neutral-700 dark:hover:text-indigo-400 dark:hover:bg-indigo-900/20 rounded-full transition-all active:scale-90"
        >
          <Pencil size={16} />
        </button>
        <button 
          onClick={() => onDelete(task.id)}
          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:text-neutral-700 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-full transition-all active:scale-90"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const FocusFlow = ({ tasks, onToggle, onShowConfetti }) => {
  const [mode, setMode] = useState('deep'); 
  const pendingTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks]);

  const activeTask = useMemo(() => {
    if (pendingTasks.length === 0) return null;
    const sorted = [...pendingTasks].sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a));
    
    if (mode === 'quick') {
      const quickWins = sorted.filter(t => t.duration === '15m' || t.duration === '30m');
      return quickWins.length > 0 ? quickWins[0] : null;
    }
    return sorted[0];
  }, [pendingTasks, mode]);

  const handleComplete = () => {
    if (activeTask) {
      onShowConfetti();
      onToggle(activeTask.id, true);
    }
  };

  if (pendingTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6 bg-gradient-to-b from-emerald-50 to-white dark:from-neutral-900 dark:to-black rounded-3xl border border-emerald-100 dark:border-neutral-800 shadow-inner">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 animate-bounce">
          <Trophy size={40} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">You are unstoppable.</h2>
        <p className="text-emerald-700 dark:text-neutral-500 mt-2">Zero tasks remaining. Enjoy your freedom.</p>
      </div>
    );
  }

  if (!activeTask && mode === 'quick') {
    return (
      <div className="text-center p-10 bg-slate-50 dark:bg-neutral-950 rounded-3xl border border-dashed border-slate-300 dark:border-neutral-800">
        <Coffee className="mx-auto text-slate-400 dark:text-neutral-600 mb-4 animate-pulse" size={32} />
        <h3 className="font-medium text-slate-700 dark:text-neutral-200">No quick wins found</h3>
        <p className="text-slate-500 dark:text-neutral-500 text-sm mb-6">Only deep work remains.</p>
        <button onClick={() => setMode('deep')} className="px-6 py-2 bg-slate-200 dark:bg-neutral-800 rounded-full text-sm font-bold hover:bg-slate-300 dark:hover:bg-neutral-700 transition-colors">
          Return to Deep Focus
        </button>
      </div>
    );
  }

  return (
    <div className="group relative bg-black rounded-3xl p-8 text-white shadow-2xl dark:shadow-[0_0_50px_rgba(79,70,229,0.2)] overflow-hidden border border-neutral-800 transition-all hover:scale-[1.01] duration-500">
      <div className={`absolute inset-0 bg-gradient-to-br opacity-20 transition-all duration-1000 ${
        activeTask.priority === 'high' ? 'from-red-600 to-orange-900' :
        activeTask.priority === 'medium' ? 'from-amber-600 to-yellow-900' :
        'from-indigo-600 to-purple-900'
      }`}></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
               {mode === 'deep' ? <Focus size={18} className="text-white" /> : <Coffee size={18} className="text-white" />}
            </div>
            <div>
               <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Current Mode</div>
               <div className="text-sm font-bold">{mode === 'deep' ? 'Deep Focus' : 'Quick Wins'}</div>
            </div>
          </div>
          
          <button 
            onClick={() => setMode(mode === 'deep' ? 'quick' : 'deep')}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
          >
            Switch to {mode === 'deep' ? 'Quick Mode' : 'Deep Mode'}
          </button>
        </div>
        
        <div className="mb-8">
            <div className="text-5xl font-bold leading-tight mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">
              {activeTask.title}
            </div>
            
            <div className="flex flex-wrap gap-3">
               <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border backdrop-blur-md ${
                 activeTask.priority === 'high' ? 'bg-red-500/20 border-red-500/50 text-red-100' : 
                 activeTask.priority === 'medium' ? 'bg-amber-500/20 border-amber-500/50 text-amber-100' :
                 'bg-indigo-500/20 border-indigo-500/50 text-indigo-100'
               }`}>
                 {activeTask.priority} Impact
               </div>
               {activeTask.duration && (
                 <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/10 bg-white/5 backdrop-blur-md text-neutral-300">
                   {activeTask.duration}
                 </div>
               )}
            </div>
        </div>
        
        <button 
          onClick={handleComplete}
          className="w-full bg-white text-black font-bold py-5 rounded-2xl hover:bg-neutral-200 active:scale-[0.98] active:bg-neutral-300 transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)] group-hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
        >
          <CheckCircle2 size={24} />
          <span>Complete Task</span>
          <ArrowRight size={20} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all" />
        </button>
      </div>
    </div>
  );
};

const TaskModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("Work");
  const [duration, setDuration] = useState("30m");
  const [dueDate, setDueDate] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        setShowDetails(true);
        if (initialData) {
          setTitle(initialData.title);
          setPriority(initialData.priority);
          setCategory(initialData.category);
          setDuration(initialData.duration || "30m");
          setDueDate(initialData.dueDate || "");
        } else {
          setTitle("");
          setPriority("medium");
          setCategory("Work");
          setDuration("30m");
          setDueDate("");
        }
      });
    } else {
      requestAnimationFrame(() => {
        setShowDetails(false);
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSave({ title, priority, category, duration, dueDate: dueDate ? dueDate : null, });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-4 sm:p-6">
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
      ></div>

      <div className="relative bg-white dark:bg-neutral-950 w-full max-w-lg rounded-[2rem] p-8 shadow-2xl transform transition-all duration-300 animate-in slide-in-from-bottom-10 zoom-in-95 border border-white/20 dark:border-neutral-800">
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-neutral-900 rounded-full text-slate-400 hover:rotate-90 transition-all"
        >
           <X size={20} />
        </button>

        <div className="mb-8">
           <h2 className="text-sm font-bold tracking-[0.2em] text-slate-400 dark:text-neutral-500 uppercase mb-2">
             {initialData ? 'Edit Task' : 'New Entry'}
           </h2>
           <input 
            autoFocus
            type="text" 
            placeholder="What is your goal?"
            className="w-full text-3xl font-bold bg-transparent placeholder:text-slate-300 dark:placeholder:text-neutral-800 text-slate-900 dark:text-white border-none focus:ring-0 p-0 leading-tight"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className={`space-y-8 transition-all duration-500 delay-75 ease-out ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          
          <div>
            <label className="text-[10px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-widest mb-3 block">Priority Level</label>
            <div className="flex gap-3">
              {['low', 'medium', 'high'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                    priority === p 
                      ? (p === 'high' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105' : 
                         p === 'medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105' : 
                         'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-105') 
                      : 'bg-slate-100 dark:bg-neutral-900 text-slate-500 dark:text-neutral-500 hover:bg-slate-200 dark:hover:bg-neutral-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-[10px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-widest mb-3 block">Duration</label>
              <select 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)}
                className="w-full appearance-none bg-slate-100 dark:bg-neutral-900 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-neutral-300 focus:ring-2 focus:ring-indigo-500 transition-shadow cursor-pointer"
              >
                <option value="15m">15 mins</option>
                <option value="30m">30 mins</option>
                <option value="1h">1 hour</option>
                <option value="2h">2 hours+</option>
                <option value="4h">Deep Work</option>
              </select>
            </div>
            
             <div>
              <label className="text-[10px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-widest mb-3 block">Due Date</label>
              <input 
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-slate-100 dark:bg-neutral-900 border-none rounded-xl py-3 px-4 text-sm font-bold text-slate-700 dark:text-neutral-300 focus:ring-2 focus:ring-indigo-500" 
              />
            </div>
          </div>

          <div>
             <label className="text-[10px] font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-widest mb-3 block">Category</label>
             <div className="flex flex-wrap gap-2">
               {['Work', 'Personal', 'Health', 'Study', 'Errands'].map((cat) => (
                 <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                      category === cat 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-100 dark:bg-neutral-900 text-slate-500 dark:text-neutral-500 hover:bg-slate-200'
                    }`}
                 >
                   {cat}
                 </button>
               ))}
             </div>
          </div>

          <button 
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="w-full py-4 bg-black dark:bg-white text-white dark:text-black font-bold text-lg rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex justify-center items-center gap-2 mt-4"
          >
            <span>{initialData ? 'Update Task' : 'Commit Task'}</span>
            <ArrowRight size={20} />
          </button>

        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('flow'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isSingularityOpen, setIsSingularityOpen] = useState(false); 
  const [filter, setFilter] = useState('active');
  const [toasts, setToasts] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [streak, setStreak] = useState(0);
  
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zenflow-theme') === 'dark' || 
             (!localStorage.getItem('zenflow-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('zenflow-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('zenflow-theme', 'light');
    }
  }, [darkMode]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const triggerConfetti = () => {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2000); 
  };

  useEffect(() => {
    const initAuth = async () => {
      await signInAnonymously(auth);
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeTasks = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const streakRef = doc(db, 'artifacts', appId, 'users', user.uid, 'stats', 'streak');
    const unsubscribeStreak = onSnapshot(streakRef, (doc) => {
      if (doc.exists()) setStreak(doc.data().current || 0);
    });

    return () => {
      unsubscribeTasks();
      unsubscribeStreak();
    };
  }, [user]);

  const handleSaveTask = async (taskData) => {
    if (!user) return;
    try {
      if (editingTask) {
        const taskRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id);
        await updateDoc(taskRef, taskData);
        addToast("Task updated successfully", "success");
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), {
          ...taskData,
          completed: false,
          createdAt: serverTimestamp()
        });
        addToast("Task committed to the flow", "success");
      }
    } catch {
      addToast("Failed to save task", "error");
    }
    setEditingTask(null); 
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setIsModalOpen(true);
  };

  const toggleTask = async (id, currentStatus) => {
    if (!user) return;
    const taskRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', id);
    await updateDoc(taskRef, { completed: currentStatus });
    
    if (!currentStatus) { 
        addToast("Momentum building...", "success");
        const streakRef = doc(db, 'artifacts', appId, 'users', user.uid, 'stats', 'streak');
        setDoc(streakRef, { current: streak + 1, lastUpdate: serverTimestamp() }, { merge: true });
    }
  };

  const deleteTask = async (id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', id));
    addToast("Task removed", "info");
  };

  const clearCompletedTasks = async () => {
    if (!user) return;
    const completed = tasks.filter(t => t.completed);
    if (completed.length === 0) return;

    const batch = writeBatch(db);
    completed.forEach(task => {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id);
      batch.delete(docRef);
    });

    try {
      await batch.commit();
      addToast(`Cleared ${completed.length} completed tasks`, "success");
    } catch{
      addToast("Failed to clear tasks", "error");
    }
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (filter === 'active') filtered = tasks.filter(t => !t.completed);
    if (filter === 'completed') filtered = tasks.filter(t => t.completed);
    return filtered.sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a));
  }, [tasks, filter]);

  const pendingCount = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;

  if (!user) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black"><div className="animate-pulse"><Zap size={40} className="text-indigo-500" /></div></div>;

  return (
    <div className={`min-h-screen transition-colors duration-700 ${darkMode ? 'dark bg-black' : 'bg-slate-50'}`}>
      <div className="min-h-screen text-slate-900 dark:text-neutral-100 font-sans selection:bg-indigo-500 selection:text-white pb-24 md:pb-0 relative overflow-hidden">
        
        {showConfetti && <ConfettiExplosion />}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <ZenSingularity isOpen={isSingularityOpen} onClose={() => setIsSingularityOpen(false)} />

        {/* Header */}
        <header className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-slate-100 dark:border-neutral-900 sticky top-0 z-40 transition-colors duration-300">
          <div className="max-w-3xl mx-auto px-4 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                <Layout size={20} />
              </div>
              <div>
                <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white block leading-none">ZenFlow</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSingularityOpen(true)}
                className="hidden md:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <InfinityIcon size={16} />
                <span>Reset</span>
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-neutral-800 hidden md:block"></div>

              <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/10 px-3 py-1.5 rounded-full border border-orange-100 dark:border-orange-900/30">
                 <Flame size={14} className="text-orange-500" fill="currentColor" />
                 <span className="text-xs font-bold text-orange-700 dark:text-orange-400">{streak}</span>
              </div>

              <button 
                onClick={toggleTheme} 
                className="p-2 rounded-full bg-slate-100 dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-8 relative z-10">
          
          <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              Your flow.
            </h1>
            <p className="text-slate-500 dark:text-neutral-500 text-lg">
              {pendingCount} tasks waiting for your attention.
            </p>
          </div>

          <div className="flex p-1 bg-slate-100 dark:bg-neutral-900 rounded-xl mb-8 w-fit">
            <button
              onClick={() => setView('flow')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                view === 'flow' 
                  ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-300'
              }`}
            >
              <Zap size={16} />
              Flow Mode
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                view === 'list' 
                  ? 'bg-white dark:bg-neutral-800 text-indigo-600 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-300'
              }`}
            >
              <ListIcon size={16} />
              All Tasks
            </button>
          </div>

          <div className="min-h-[400px]">
            {view === 'flow' ? (
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                <FocusFlow tasks={tasks} onToggle={toggleTask} onShowConfetti={triggerConfetti} />
                
                {tasks.filter(t => !t.completed).length > 1 && (
                  <div className="mt-12 opacity-50 hover:opacity-100 transition-opacity duration-300">
                    <div className="text-xs font-bold text-slate-400 dark:text-neutral-600 uppercase tracking-widest mb-4 text-center">Up Next</div>
                    <div className="scale-95 origin-top space-y-2">
                      {tasks
                        .filter(t => !t.completed)
                        .sort((a, b) => calculatePriorityScore(b) - calculatePriorityScore(a))
                        .slice(1, 3)
                        .map(t => (
                          <div key={t.id} className="bg-white dark:bg-neutral-900 p-4 rounded-xl border border-slate-100 dark:border-neutral-800 flex justify-between items-center">
                            <span className="font-medium text-slate-600 dark:text-neutral-400">{t.title}</span>
                            <span className="text-xs font-mono text-slate-400 dark:text-neutral-600">{t.duration}</span>
                          </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex overflow-x-auto gap-2 scrollbar-hide">
                    {['active', 'all', 'completed'].map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                          filter === f 
                            ? 'bg-black dark:bg-white text-white dark:text-black shadow-lg' 
                            : 'bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-slate-500 dark:text-neutral-500 hover:border-slate-300'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  
                  {completedCount > 0 && (
                    <button 
                      onClick={clearCompletedTasks}
                      className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-red-500 dark:text-neutral-600 dark:hover:text-red-400 flex items-center gap-2 transition-colors"
                    >
                      <Archive size={14} />
                      <span className="hidden sm:inline">Clear Done</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3 pb-24">
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-20 rounded-3xl border-2 border-dashed border-slate-200 dark:border-neutral-900">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 dark:text-neutral-600">
                        <Filter size={24} />
                      </div>
                      <p className="text-slate-500 dark:text-neutral-500 font-medium">Nothing to see here.</p>
                    </div>
                  ) : (
                    filteredTasks.map((task, idx) => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        onToggle={toggleTask} 
                        onDelete={deleteTask} 
                        onEdit={openEditModal}
                        index={idx} 
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <button 
          onClick={() => { setEditingTask(null); setIsModalOpen(true); }}
          className="fixed bottom-8 right-6 md:bottom-10 md:right-10 group z-30"
        >
          <div className="absolute inset-0 bg-indigo-500 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-200 animate-pulse"></div>
          <div className="relative w-16 h-16 bg-black dark:bg-white text-white dark:text-black rounded-full shadow-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 active:scale-90">
            <Plus size={32} />
          </div>
        </button>

        <TaskModal 
          isOpen={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingTask(null); }}
          onSave={handleSaveTask}
          initialData={editingTask}
        />
      </div>
    </div>
  );
}