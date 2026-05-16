import React, { useState, useRef, useEffect } from 'react';
import { Menu, ChevronDown, Users, Zap, Share2, Flame, Minus, Plus, Bookmark, Image as ImageIcon, Camera, Send, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isSameDay } from 'date-fns';
import { cn } from './lib/utils';
import { analyzeFoodImageAndText, ScanResult, FoodItem } from './services/geminiService';
import { DailyLog, defaultGoals } from './types';
import { UserProfile, calculateGoals } from './lib/nutrition';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('user_profile');
    return saved ? JSON.parse(saved) : null;
  });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());

  const [logs, setLogs] = useState<Record<string, DailyLog>>(() => {
    const saved = localStorage.getItem('nutrition_logs');
    return saved ? JSON.parse(saved) : {};
  });

  const currentDateLog = logs[selectedDate] || {
    date: selectedDate,
    waterIntake: 0,
    weight: profile?.weight || null,
    foodItems: [],
    coachFeedbacks: []
  };
  
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const currentGoals = profile ? calculateGoals(profile) : defaultGoals;

  const totalCalories = currentDateLog.foodItems.reduce((acc, item) => acc + item.calories, 0);
  const totalProtein = currentDateLog.foodItems.reduce((acc, item) => acc + item.protein, 0);
  const totalCarbs = currentDateLog.foodItems.reduce((acc, item) => acc + item.carbs, 0);
  const totalFats = currentDateLog.foodItems.reduce((acc, item) => acc + item.fats, 0);

  const exerciseCalories = 0; // Mock exercise calories
  const caloriesRemaining = Math.max(0, currentGoals.calories - totalCalories + exerciseCalories);
  const waterRemaining = Math.max(0, currentGoals.waterIntakeInt - currentDateLog.waterIntake);

  useEffect(() => {
    if (!profile && !showProfileModal) {
      setShowProfileModal(true);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) localStorage.setItem('user_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('nutrition_logs', JSON.stringify(logs));
  }, [logs]);

  // Sync profile weight changes to today's log only if looking at today
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (profile && selectedDate === today && currentDateLog.weight !== profile.weight) {
      updateCurrentLog(prev => ({ ...prev, weight: profile.weight }));
    }
  }, [profile, selectedDate]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [currentDateLog.foodItems, currentDateLog.coachFeedbacks, isAnalyzing]);

  const updateCurrentLog = (updateFn: (prev: DailyLog) => DailyLog) => {
    setLogs(prev => {
      const prevLog = prev[selectedDate] || {
        date: selectedDate,
        waterIntake: 0,
        weight: profile?.weight || null,
        foodItems: [],
        coachFeedbacks: []
      };
      return { ...prev, [selectedDate]: updateFn(prevLog) };
    });
  };

  const handleWaterChange = (delta: number) => {
    updateCurrentLog(prev => ({
      ...prev,
      waterIntake: Math.max(0, Math.min(prev.waterIntake + delta, 20))
    }));
  };

  const processAIResponse = (result: ScanResult) => {
    updateCurrentLog(prev => {
      let nextCoachFeedbacks = prev.coachFeedbacks || [];
      if (result.coachFeedback) {
        nextCoachFeedbacks = [
          ...nextCoachFeedbacks, 
          { id: Math.random().toString(36).substring(7), text: result.coachFeedback, date: new Date().toISOString() }
        ];
      }
      return {
        ...prev,
        foodItems: [
          ...prev.foodItems,
          ...result.foodItems.map(item => ({ ...item, id: Math.random().toString(36).substring(7) }))
        ],
        coachFeedbacks: nextCoachFeedbacks
      };
    });
  };

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isAnalyzing) return;
    
    const textToAnalyze = inputText;
    setInputText('');
    setIsAnalyzing(true);
    
    try {
      const userContext = profile ? {
        dailyGoals: currentGoals,
        currentTotals: { calories: totalCalories, protein: totalProtein, carbs: totalCarbs, fats: totalFats },
        goal: profile.goal
      } : undefined;
      const result = await analyzeFoodImageAndText(null, null, textToAnalyze, userContext);
      processAIResponse(result);
    } catch (error: any) {
      alert(error.message || 'Failed to analyze text.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        try {
          const userContext = profile ? {
            dailyGoals: currentGoals,
            currentTotals: { calories: totalCalories, protein: totalProtein, carbs: totalCarbs, fats: totalFats },
            goal: profile.goal
          } : undefined;
          const result = await analyzeFoodImageAndText(base64Data, mimeType, "Analyze this food image.", userContext);
          processAIResponse(result);
        } catch (error: any) {
          alert(error.message || 'Error analyzing image.');
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
    }
    
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const generateDays = () => {
    const baseDate = new Date(selectedDate);
    const days = [];
    for (let i = -3; i <= 3; i++) {
        days.push(addDays(baseDate, i));
    }
    return days;
  };

  const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const minDayAbbreviations = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isTodayAbsolute = selectedDate === format(new Date(), 'yyyy-MM-dd');

  const generateMonthDays = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const prefixDays = Array.from({ length: startDay }).map(() => null);
    return [...prefixDays, ...days];
  };

  const monthDays = generateMonthDays(calendarViewDate);

  return (
    <div className="mx-auto max-w-md h-screen bg-white flex flex-col relative overflow-hidden font-sans">
      
      {/* Top Bar */}
      <header className="px-4 py-4 flex items-center justify-between bg-white text-slate-800 shrink-0 relative z-50">
        <div className="flex items-center gap-4">
          <Menu className="w-6 h-6 text-black" />
          <button 
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-1 text-lg relative cursor-pointer outline-none"
          >
            <span className="font-semibold">{isTodayAbsolute ? 'Today' : format(new Date(selectedDate), 'MMM d, yyyy')}</span>
            <ChevronDown className={cn("w-4 h-4 mt-0.5 transition-transform", showCalendar && "rotate-180")} />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowProfileModal(true)} className="relative">
            <Users className="w-5 h-5 text-slate-700" />
            {!profile && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-white" />}
          </button>
          <div className="flex items-center gap-1 text-slate-700">
            <Zap className="w-5 h-5 fill-slate-700" />
            <span className="font-medium text-sm">0</span>
          </div>
          <Share2 className="w-5 h-5 text-slate-700" />
        </div>
      </header>

      {/* Calendar Dropdown */}
      <AnimatePresence>
        {showCalendar && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCalendar(false)}
              className="absolute inset-0 bg-black/20 z-40"
            />
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute top-[60px] left-0 right-0 bg-white z-50 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] border-b border-slate-100 rounded-b-2xl overflow-hidden pt-2 pb-4 px-4"
            >
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-4">
                {minDayAbbreviations.map((d, i) => (
                  <div key={i} className="text-center text-[11px] font-semibold text-slate-500 uppercase">{d}</div>
                ))}
              </div>
              
              {/* Dates grid */}
              <div className="grid grid-cols-7 gap-y-3 mb-6">
                {monthDays.map((date, idx) => {
                  if (!date) return <div key={idx} />;
                  
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const isDateSelected = dateStr === selectedDate;
                  const isDateToday = isSameDay(date, new Date());
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        setShowCalendar(false);
                      }}
                      className="relative flex items-center justify-center h-8"
                    >
                      <span className={cn(
                        "w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors",
                        isDateSelected ? "bg-[#eef2fc] text-blue-600 font-bold" : 
                        isDateToday ? "bg-slate-100 font-semibold" : "text-slate-700 hover:bg-slate-50"
                      )}>
                        {date.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Month Pills and Year */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide items-center px-1">
                <span className="text-sm font-semibold text-slate-700 shrink-0 mr-2">{format(calendarViewDate, 'yyyy')}</span>
                {monthNames.map((month, idx) => {
                  const isCurrentMonthView = calendarViewDate.getMonth() === idx;
                  return (
                    <button 
                      key={idx}
                      onClick={() => {
                        const newDate = new Date(calendarViewDate);
                        newDate.setMonth(idx);
                        setCalendarViewDate(newDate);
                      }}
                      className={cn(
                        "px-4 py-1.5 rounded-xl text-[13px] font-medium whitespace-nowrap border shrink-0 transition-all",
                        isCurrentMonthView 
                          ? "bg-blue-100 border-blue-200 text-blue-800" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {month}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pb-24" ref={chatScrollRef}>
        
        {/* Calendar Strip */}
        <div className="px-2 py-2 flex justify-between items-center mb-2">
          {generateDays().map((date, index) => {
            const dateString = format(date, 'yyyy-MM-dd');
            const isSelected = dateString === selectedDate;
            const isToday = dateString === format(new Date(), 'yyyy-MM-dd');
            return (
              <div 
                key={index} 
                className="flex flex-col items-center cursor-pointer"
                onClick={() => setSelectedDate(dateString)}
              >
                <span className="text-[11px] text-slate-500 mb-1">{dayAbbreviations[date.getDay()]}</span>
                <div 
                  className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center text-[15px] font-medium transition-colors",
                    isSelected ? "bg-slate-800 text-white font-bold shadow-md" : isToday ? "bg-green-100 text-slate-800" : "bg-white border border-slate-200 text-slate-800 hover:bg-slate-50"
                  )}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dashboard Grid */}
        <div className="px-4 space-y-3">
          
          <div className="grid grid-cols-2 gap-3">
            {/* Calories Card */}
            <div className="bg-[#eef2fc] rounded-[20px] p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
                </div>
                <h3 className="font-bold text-slate-900 text-[15px]">Calories</h3>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-left">
                  <div className="text-lg font-bold text-slate-900 leading-none">{totalCalories}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Food</div>
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold text-slate-900 leading-none">{exerciseCalories}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Exercise</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-slate-900 leading-none">{caloriesRemaining}</div>
                  <div className="text-[11px] text-slate-500 mt-1">Remaining</div>
                </div>
              </div>
            </div>

            {/* Macros Card */}
            <div className="bg-[#eef2fc] rounded-[20px] p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12" stroke="#d946ef" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-[15px]">Macros</h3>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-left">
                  <div className="text-[13px] font-semibold text-slate-900 leading-none">{totalCarbs}/{currentGoals.carbs}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Carbs (g)</div>
                </div>
                <div className="text-center">
                  <div className="text-[13px] font-semibold text-slate-900 leading-none">{totalProtein}/{currentGoals.protein}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Protein (g)</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold text-slate-900 leading-none">{totalFats}/{currentGoals.fats}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Fat (g)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Water Tracker */}
          <div className="border border-slate-200 rounded-[20px] p-4">
            <div className="text-slate-800 mb-3 text-sm">
                Water: {(currentDateLog.waterIntake * 0.25).toFixed(1)}L
            </div>
            <div className="border-t border-slate-100 pt-3 flex items-center justify-between">
                <button onClick={() => handleWaterChange(-1)} className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-md">
                    <Minus className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <div className="text-sm text-slate-900">{currentDateLog.waterIntake} Cups</div>
                    <div className="text-xs text-slate-500">{waterRemaining} Cups Remaining</div>
                </div>
                <button onClick={() => handleWaterChange(1)} className="w-8 h-8 flex items-center justify-center text-slate-900 hover:bg-slate-100 rounded-md">
                    <Plus className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>

        {/* Meal Log & Coach Feedback Timeline */}
        <div className="px-4 py-6 space-y-4">
          <AnimatePresence initial={false}>
            {currentDateLog.foodItems.length > 0 && (
              <div className="space-y-3">
                {currentDateLog.foodItems.map((item, idx) => (
                    <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={item.id} 
                    className="border border-slate-200 p-4 rounded-[20px] flex gap-3 bg-white"
                    >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                        <span className="text-base">🍔</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="font-medium text-slate-800 text-[15px] truncate leading-tight">{item.name}</p>
                        <p className="text-xs text-slate-500 mt-1">{item.portion}</p>
                    </div>
                    <div className="text-right flex flex-col justify-center shrink-0 ml-1">
                        <span className="font-bold text-slate-900 text-base leading-tight">{item.calories}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wide">kcal</span>
                    </div>
                    </motion.div>
                ))}
              </div>
            )}
            
            {/* Coach Feedbacks */}
            {currentDateLog.coachFeedbacks && currentDateLog.coachFeedbacks.map((fb) => (
              <motion.div 
                key={fb.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="bg-[#eef2fc] p-4 rounded-[20px] relative overflow-hidden"
              >
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mt-0.5 shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#3b82f6" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    </div>
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-blue-600 block mb-1">AI Coach</span>
                        <p className="text-slate-800 text-sm leading-relaxed">
                            {fb.text}
                        </p>
                    </div>
                </div>
              </motion.div>
            ))}

            {isAnalyzing && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="flex items-center justify-center p-4"
               >
                 <div className="flex gap-2">
                     <span className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                     <span className="w-2 h-2 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                     <span className="w-2 h-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                 </div>
               </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Bottom Input */}
      <div className="absolute bottom-0 left-0 w-full bg-white p-4 z-40 border-t border-slate-100">
        <form onSubmit={handleTextSubmit} className="flex items-center gap-3 bg-[#f3f4f6] px-4 py-3 rounded-full">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={cameraInputRef}
            onChange={handleFileChange}
          />
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={galleryInputRef}
            onChange={handleFileChange}
          />
          <input 
            type="text" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="What did you eat or exercise?" 
            disabled={isAnalyzing}
            className="flex-1 min-w-0 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-500 outline-none disabled:opacity-50"
          />
          {inputText.trim() ? (
            <button 
                type="submit" 
                disabled={isAnalyzing}
                className="w-6 h-6 flex items-center justify-center text-slate-600 outline-none shrink-0"
            >
                <Send className="w-5 h-5" />
            </button>
          ) : (
            <>
                <button type="button" onClick={() => setShowManualEntryModal(true)} className="text-slate-600 outline-none shrink-0 hover:text-slate-900 transition-colors" disabled={isAnalyzing}>
                    <Bookmark className="w-[22px] h-[22px]" />
                </button>
                <button type="button" onClick={() => galleryInputRef.current?.click()} className="text-slate-600 outline-none shrink-0" disabled={isAnalyzing}>
                    <ImageIcon className="w-[22px] h-[22px]" />
                </button>
                <button type="button" onClick={() => cameraInputRef.current?.click()} className="text-slate-600 outline-none shrink-0" disabled={isAnalyzing}>
                    <Camera className="w-[22px] h-[22px]" />
                </button>
            </>
          )}
        </form>
      </div>

      {/* Profile Setup Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[24px] w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="font-bold text-lg text-slate-800">Your Measurements</h3>
                <button onClick={() => { if(profile) setShowProfileModal(false); }} className="p-2 text-slate-400 hover:text-slate-600 rounded-full" disabled={!profile}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto bg-white">
                <form id="profileForm" onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  setProfile({
                    gender: fd.get('gender') as any,
                    age: Number(fd.get('age')),
                    height: Number(fd.get('height')),
                    weight: Number(fd.get('weight')),
                    activityLevel: fd.get('activityLevel') as any,
                    goal: fd.get('goal') as any,
                  });
                  setShowProfileModal(false);
                }} className="space-y-4">
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Gender</label>
                      <select name="gender" defaultValue={profile?.gender || 'female'} className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none appearance-none">
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Age</label>
                      <input type="number" name="age" defaultValue={profile?.age || 25} required className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Height (cm)</label>
                      <input type="number" name="height" defaultValue={profile?.height || 165} required className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Weight (kg)</label>
                      <input type="number" step="0.1" name="weight" defaultValue={profile?.weight || 65} required className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Activity Level</label>
                    <select name="activityLevel" defaultValue={profile?.activityLevel || 'moderately_active'} className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none appearance-none">
                      <option value="sedentary">Sedentary (Little/no exercise)</option>
                      <option value="lightly_active">Lightly Active (1-3 days/wk)</option>
                      <option value="moderately_active">Moderately Active (3-5 days/wk)</option>
                      <option value="very_active">Very Active (6-7 days/wk)</option>
                      <option value="extra_active">Extra Active (Labor/training)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Goal</label>
                    <select name="goal" defaultValue={profile?.goal || 'maintain'} className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none appearance-none">
                      <option value="lose">Lose Weight</option>
                      <option value="maintain">Maintain Weight</option>
                      <option value="gain">Gain Muscle / Weight</option>
                    </select>
                  </div>

                </form>
              </div>
              <div className="p-6 pt-0 mt-2">
                 <button type="submit" form="profileForm" className="w-full bg-[#eef2fc] text-slate-900 border border-slate-200 font-semibold py-3.5 rounded-xl shadow-sm active:scale-[0.98] transition-all">
                   Save & Calculate Plan
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {showManualEntryModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[24px] w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white">
                <h3 className="font-bold text-lg text-slate-800">Add Meal Manually</h3>
                <button onClick={() => setShowManualEntryModal(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto bg-white">
                <form id="manualEntryForm" onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget as HTMLFormElement);
                  const newMeal = {
                    id: Math.random().toString(36).substring(7),
                    name: fd.get('name') as string,
                    portion: fd.get('portion') as string || '1 serving',
                    calories: parseInt(fd.get('calories') as string) || 0,
                    protein: parseInt(fd.get('protein') as string) || 0,
                    carbs: parseInt(fd.get('carbs') as string) || 0,
                    fats: parseInt(fd.get('fats') as string) || 0,
                  };
                  
                  updateCurrentLog(prev => ({
                    ...prev,
                    foodItems: [...prev.foodItems, newMeal]
                  }));
                  
                  setShowManualEntryModal(false);
                }} className="space-y-4">
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Food Name</label>
                    <input type="text" name="name" required placeholder="e.g. Chicken Salad" className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Portion</label>
                    <input type="text" name="portion" placeholder="e.g. 1 bowl" className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Calories (kcal)</label>
                    <input type="number" name="calories" required className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Protein (g)</label>
                      <input type="number" name="protein" required className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Carbs (g)</label>
                      <input type="number" name="carbs" required className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Fats (g)</label>
                      <input type="number" name="fats" required className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl px-3 py-3 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all font-medium" />
                    </div>
                  </div>

                </form>
              </div>
              <div className="p-6 pt-0 mt-2">
                 <button type="submit" form="manualEntryForm" className="w-full bg-[#eef2fc] text-slate-900 border border-slate-200 font-semibold py-3.5 rounded-xl shadow-sm hover:bg-[#e4ebfa] active:scale-[0.98] transition-all">
                   Save Meal
                 </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}


