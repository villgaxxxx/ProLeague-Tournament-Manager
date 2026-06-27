import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';

export default function Matches({ setActiveTab }) {
    const [matches, setMatches] = useState([]);
    const [champion, setChampion] = useState(null);
    const isAdmin = !!localStorage.getItem('adminToken');
    
    const [postponingMatchId, setPostponingMatchId] = useState(null);
    const [postponeReason, setPostponeReason] = useState("");
    const [newMatchDate, setNewMatchDate] = useState("");
    
    const [matchTimers, setMatchTimers] = useState({}); 
    const [redCardTimers, setRedCardTimers] = useState({});
    
    const isFetching = useRef(false);

    // دالة الجلب المربوطة بالباك إند الذكي
    const fetchMatches = useCallback(async () => {
        if (isFetching.current) return;
        isFetching.current = true;

        try {
            const res = await fetch('/api/Matches');
            if (!res.ok) throw new Error("Server Error");

            const data = await res.json();
            const matchesArray = Array.isArray(data) ? data : data?.$values || [];
            setMatches(matchesArray);
            
            setMatchTimers(prev => {
                const newTimers = { ...prev };
                matchesArray.forEach(m => {
                    const mId = m.id || m.Id;
                    if (m.isPlaying || m.IsPlaying) {
                        
                        const startTime = m.startTime || m.StartTime;
                        const isPaused = m.isTimerPaused || m.IsTimerPaused;
                        const dbElapsed = m.elapsedSeconds || m.ElapsedSeconds || 0;
                        
                        let currentElapsed = dbElapsed;

                        // لو العداد شغال، نجمع الثواني المحفوظة + الثواني اللي عدت من آخر StartTime
                        if (!isPaused && startTime) {
                            const utcTime = startTime.endsWith('Z') ? startTime : `${startTime}Z`;
                            const diff = Math.floor((Date.now() - new Date(utcTime).getTime()) / 1000);
                            if (diff > 0) currentElapsed += diff;
                        }

                        newTimers[mId] = { elapsed: currentElapsed, isRunning: !isPaused };
                    }
                });
                return newTimers;
            });
        } catch (err) {
            console.warn("⚠️ تم تجاهل خطأ في الجلب:", err.message);
        } finally {
            isFetching.current = false;
        }
    }, []);

    useEffect(() => {
        fetchMatches(); 
        const pollInterval = setInterval(() => fetchMatches(), 5000);
        return () => clearInterval(pollInterval);
    }, [fetchMatches]);

    useEffect(() => {
        const timerInterval = setInterval(() => {
            setMatchTimers(prev => {
                const newTimers = { ...prev };
                let updated = false;
                Object.keys(newTimers).forEach(matchId => {
                    if (newTimers[matchId].isRunning) {
                        newTimers[matchId].elapsed += 1;
                        updated = true;
                    }
                });
                return updated ? newTimers : prev;
            });

            setRedCardTimers(prev => {
                const newRedCards = { ...prev };
                let updated = false;
                Object.keys(newRedCards).forEach(key => {
                    if (newRedCards[key] > 0) {
                        newRedCards[key] -= 1;
                        updated = true;
                    }
                });
                return updated ? newRedCards : prev;
            });
        }, 1000);
        
        return () => clearInterval(timerInterval);
    }, []);

    const formatTime = (totalSeconds) => {
        if (!totalSeconds || totalSeconds < 0) return "00:00";
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // إيقاف وهمي للعداد عشان لو دوسنا صافرة النهاية الشاشة تقف فوراً
    const pauseTimerLocally = (matchId) => {
        setMatchTimers(prev => {
            const current = prev[matchId] || { elapsed: 0, isRunning: false };
            return { ...prev, [matchId]: { ...current, isRunning: false } };
        });
    };

    // 🔥 دالة الإيقاف/الاستئناف المربوطة بالباك إند 🔥
    const handleToggleTimer = async (matchId) => {
        // نعكس الحالة فوراً عند الإدمن عشان يحس بسرعة الاستجابة
        setMatchTimers(prev => {
            const current = prev[matchId] || { elapsed: 0, isRunning: false };
            return { ...prev, [matchId]: { ...current, isRunning: !current.isRunning } };
        });

        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Matches/${matchId}/toggle-timer`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchMatches(); // نجيب التأكيد من السيرفر
    };

    const handleStartMatch = async (id) => {
        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Matches/${id}/start`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchMatches();
    };

    const handleFinishMatch = async (id) => {
        pauseTimerLocally(id); // تجميد فوراً
        const match = matches.find(m => m.id === id || m.Id === id);
        const isKnockout = match.matchType !== "Group" && match.MatchType !== "Group";
        const t1Score = match.team1Score ?? match.Team1Score ?? 0;
        const t2Score = match.team2Score ?? match.Team2Score ?? 0;
        const isTie = t1Score === t2Score;

        if (isKnockout && isTie) {
            const t1Name = match.team1?.name || match.team1?.Name || "الفريق الأول";
            const t2Name = match.team2?.name || match.team2?.Name || "الفريق الثاني";
            alert("🛑 تنبيه: مباريات خروج المغلوب لا يمكن أن تنتهي بالتعادل! يرجى إدخال نتيجة ضربات الترجيح.");
            const p1 = window.prompt(`⚽ أدخل عدد ضربات الترجيح الناجحة لفريق (${t1Name}):`);
            if (p1 === null || p1.trim() === "") { fetchMatches(); return; }
            const p2 = window.prompt(`⚽ أدخل عدد ضربات الترجيح الناجحة لفريق (${t2Name}):`);
            if (p2 === null || p2.trim() === "") { fetchMatches(); return; }
            const pen1 = parseInt(p1);
            const pen2 = parseInt(p2);
            if (pen1 === pen2) {
                alert("لا يمكن أن تنتهي ضربات الترجيح بالتعادل!"); fetchMatches(); return;
            }
            const confirmFinish = window.confirm(`✅ تأكيد فوز (${pen1 > pen2 ? t1Name : t2Name}) بضربات الترجيح وإنهاء المباراة؟`);
            if (!confirmFinish) { fetchMatches(); return; }

            const token = localStorage.getItem('adminToken');
            const response = await fetch(`/api/Matches/${id}/finish-knockout`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ team1Penalties: pen1, team2Penalties: pen2 })
            });
            const data = await response.json();
            if (data.championName || data.ChampionName) setChampion(data.championName || data.ChampionName);
            fetchMatches();
            return;
        }

        const confirmFinish = window.confirm("هل أنت متأكد من إنهاء المباراة بالنتيجة الحالية؟ 🛑");
        if (!confirmFinish) {
            fetchMatches(); // استرجاع التايمر
            return;
        }

        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/Matches/${id}/finish`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.championName || data.ChampionName) setChampion(data.championName || data.ChampionName);
        fetchMatches();
    };

    const handleStartPostpone = (match) => {
        setPostponingMatchId(match.id || match.Id);
        setPostponeReason(match.postponeReason || match.PostponeReason || "");
        const mDate = match.matchDate || match.MatchDate;
        setNewMatchDate(mDate ? new Date(mDate).toISOString().slice(0, 16) : "");
    };
    const handleCancelPostpone = () => { setPostponingMatchId(null); setPostponeReason(""); setNewMatchDate(""); };
    const handleConfirmPostpone = async (matchId) => {
        if (!postponeReason || !newMatchDate) return alert("يرجى إدخال سبب التأجيل والموعد الجديد!");
        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch(`/api/Matches/${matchId}/postpone`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ Reason: postponeReason, NewDate: new Date(newMatchDate).toISOString() })
            });
            if (res.ok) { setPostponingMatchId(null); fetchMatches(); } 
        } catch { alert("مشكلة في الاتصال بالسيرفر."); }
    };

    const handleDeleteMatch = async (matchId) => {
        const confirmDelete = window.confirm("⚠️ هل أنت متأكد من حذف هذه المباراة نهائياً؟");
        if (!confirmDelete) return;
        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch(`/api/Matches/${matchId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) fetchMatches();
        } catch { alert("مشكلة في الاتصال."); }
    };

    const handleWithdraw = async (matchId, withdrawingTeamId, teamName) => {
        const confirmWithdraw = window.confirm(`🚨 تأكيد انسحاب فريق "${teamName}"؟ ستنتهي المباراة 3-0!`);
        if (!confirmWithdraw) return;
        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch(`/api/Matches/${matchId}/withdraw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(withdrawingTeamId) 
            });
            if (res.ok) fetchMatches();
        } catch { alert('مشكلة في الاتصال بالسيرفر.'); }
    };

    const actionPlayer = async (matchId, playerId, action) => {
        const token = localStorage.getItem('adminToken');
        const currentMatchSeconds = matchTimers[matchId]?.elapsed || 0;
        const currentMinute = Math.floor(currentMatchSeconds / 60) + 1;

        let finalAction = action;

        // 🔥 التعديل هنا: خلينا البحث مرن جداً عشان يتجنب مشاكل السمول والكابيتال وأنواع الداتا 🔥
        if (action === 'yellow-card') {
            // بنجيب الماتش المطابق (== عشان نتجاهل نوع الداتا)
            const match = matches.find(m => m.id == matchId || m.Id == matchId);
            
            // بنجيب الأحداث (سواء كانت سمول أو كابيتال)
            const events = match?.matchEvents || match?.MatchEvents || [];
            
            // بنعد الإنذارات القديمة للاعب ده في الماتش ده
            const previousYellows = events.filter(e => 
                (e.playerId == playerId || e.PlayerId == playerId) && 
                (e.eventType === 'yellow-card' || e.EventType === 'yellow-card')
            ).length;

            if (previousYellows >= 1) {
                finalAction = 'red-card';
            }
        }

        // تشغيل تايمر الـ 2 دقيقة لو الأكشن طرد (سواء مباشر أو تحول من إنذار)
        if (finalAction === 'red-card') {
            setRedCardTimers(prev => ({ ...prev, [`${matchId}-${playerId}`]: 120 }));
        }

        // نبعت الأكشن النهائي للسيرفر
        await fetch(`/api/Matches/${matchId}/${finalAction}/${playerId}?minute=${currentMinute}`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        
        fetchMatches(); 
    };

    const handleDownloadRoundImage = async (roundKey) => {
        const elementId = `capture-${roundKey.replace(/\s+/g, '-')}`;
        const element = document.getElementById(elementId);
        if (!element) return;
        try {
            const originalBg = element.style.backgroundColor;
            const originalPadding = element.style.padding;
            const originalRadius = element.style.borderRadius;
            element.style.backgroundColor = '#f8fafc';
            element.style.padding = '20px';
            element.style.borderRadius = '16px';

            const dataUrl = await toPng(element, { quality: 1.0, pixelRatio: 2, filter: (n) => !n?.classList?.contains('hide-in-screenshot') });

            element.style.backgroundColor = originalBg;
            element.style.padding = originalPadding;
            element.style.borderRadius = originalRadius;

            const link = document.createElement('a'); link.download = `${roundKey}-مباريات.png`; link.href = dataUrl; link.click();
        } catch (error) { alert("حدث خطأ أثناء تجهيز الصورة."); }
    };

    const activeMatches = matches.filter(m => !(m.isFinished === true || m.IsFinished === true));
    const matchesByRound = activeMatches.reduce((acc, match) => {
        const type = match.matchType || match.MatchType;
        let roundKey = (type !== "Group" && type !== undefined && type !== null) ? `${type} 🏆` : `الجولة ${match.roundNumber ?? match.RoundNumber ?? 1}`;
        if (!acc[roundKey]) acc[roundKey] = [];
        acc[roundKey].push(match);
        return acc;
    }, {});

    return (
        <div className="max-w-5xl mx-auto mt-8 px-4 mb-16" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-10 text-gray-800">جدول مباريات البطولة 🗓️</h2>

            {Object.keys(matchesByRound).length === 0 ? (
                <div className="text-center bg-gray-50 border border-gray-200 p-8 rounded-2xl shadow-sm">
                    <p className="text-gray-500 font-bold text-xl mb-2">لا توجد مباريات جارية حالياً.</p>
                </div>
            ) : (
                Object.keys(matchesByRound).map(roundKey => {
                    const safeId = `capture-${roundKey.replace(/\s+/g, '-')}`;

                    return (
                        <div key={roundKey} className="mb-14 relative">
                            {isAdmin && (
                                <div className="flex justify-end mb-4 px-2">
                                    <button onClick={() => handleDownloadRoundImage(roundKey)} className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2 rounded-xl font-bold hover:shadow-lg transition text-sm">
                                        <span>📸</span> تحميل جدول {roundKey}
                                    </button>
                                </div>
                            )}

                            <div id={safeId} className="p-4 rounded-3xl bg-gray-50/50 border border-gray-100 shadow-sm">
                                <div className="flex items-center justify-center mb-8">
                                    <h3 className="text-xl sm:text-2xl font-black bg-blue-950 text-white px-8 py-3 rounded-full shadow-lg border-4 border-blue-100 flex items-center gap-2">
                                        {!isNaN(roundKey.charAt(0)) ? `⚽ الجولة رقم ${roundKey}` : `🏆 ${roundKey}`}
                                    </h3>
                                </div>

                                <div className="grid gap-6">
                                    {matchesByRound[roundKey].map(match => {
                                        const matchId = match.id || match.Id;
                                        const isPlaying = match.isPlaying || match.IsPlaying;
                                        const t1Players = Array.isArray(match.team1?.players) ? match.team1.players : (match.team1?.players?.$values || []);
                                        const t2Players = Array.isArray(match.team2?.players) ? match.team2.players : (match.team2?.players?.$values || []);
                                        
                                        const cardBg = match.isPostponed ? 'bg-gray-100 border-gray-300 opacity-90' : 
                                                       isPlaying ? 'bg-white border-red-500 shadow-xl' : 
                                                       'bg-white border-blue-400 shadow-md hover:shadow-lg transition';

                                        return (
                                            <div key={matchId} className={`p-4 sm:p-6 rounded-xl border-r-8 flex flex-col items-center relative ${cardBg}`}>
                                                
                                                {(match.groupName || match.GroupName) && (
                                                    <div className="absolute top-0 left-0 bg-blue-100 text-blue-800 px-3 py-1 text-[10px] sm:text-xs font-bold rounded-br-lg">
                                                        المجموعة {match.groupName || match.GroupName}
                                                    </div>
                                                )}

                                                {isAdmin && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMatch(matchId); }} className="absolute top-8 left-2 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white p-2 rounded-full shadow-sm z-10 transition border border-transparent hover:border-red-700 hide-in-screenshot">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                                    </button>
                                                )}

                                                <div className="text-[10px] sm:text-xs text-gray-500 mb-2 bg-gray-200 px-4 py-1 rounded-full font-bold mt-2 sm:mt-0">
                                                    {match.matchDate && new Date(match.matchDate).getFullYear() > 2001 
                                                        ? new Date(match.matchDate).toLocaleString('ar-EG', { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                                        : 'لم يتم تحديد الموعد بعد ⏳'}
                                                </div>

                                                {match.isPostponed && (
                                                    <div className="bg-red-50 text-red-700 px-4 py-1.5 rounded-lg font-black mt-2 text-center text-xs sm:text-sm border border-red-200 w-full">
                                                        🚫 المباراة مؤجلة: {match.postponeReason || match.PostponeReason}
                                                    </div>
                                                )}

                                                <div className="flex justify-between items-center w-full mt-4 px-1 sm:px-4">
                                                    <div className="flex flex-col items-center flex-1">
                                                        <span className={`text-sm xs:text-base sm:text-xl md:text-2xl font-black text-center break-words px-1 ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>
                                                            {match.team1?.name || match.Team1?.Name}
                                                        </span>
                                                        {isAdmin && <button onClick={(e) => { e.stopPropagation(); handleWithdraw(matchId, match.team1Id || match.Team1Id, match.team1?.name || match.Team1?.Name); }} className="mt-2 text-[10px] sm:text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-600 hover:text-white transition shadow-sm hide-in-screenshot">انسحاب 🏃‍♂️</button>}
                                                    </div>

                                                    <div className="shrink-0 mx-2 flex flex-col justify-center items-center">
                                                        {isPlaying ? (
                                                            <div className="flex flex-col items-center gap-1.5 w-full">
                                                                <div className="flex items-center gap-2 sm:gap-3 bg-gray-100 text-gray-800 px-3 py-1 sm:px-5 sm:py-2 rounded-xl font-mono text-xl sm:text-3xl font-black border-2 border-gray-300 shadow-sm">
                                                                    <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
                                                                </div>
                                                                <div className="bg-red-600 text-white px-3 py-0.5 rounded font-mono text-sm sm:text-lg font-black shadow-md border border-red-800 w-full min-w-[80px] text-center">
                                                                    ⏱️ {formatTime(matchTimers[matchId]?.elapsed)}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 font-black text-sm sm:text-xl bg-gray-100 px-4 py-1 rounded-lg border border-gray-200">VS</span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col items-center flex-1">
                                                        <span className={`text-sm xs:text-base sm:text-xl md:text-2xl font-black text-center break-words px-1 ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>
                                                            {match.team2?.name || match.Team2?.Name}
                                                        </span>
                                                        {isAdmin && <button onClick={(e) => { e.stopPropagation(); handleWithdraw(matchId, match.team2Id || match.Team2Id, match.team2?.name || match.Team2?.Name); }} className="mt-2 text-[10px] sm:text-xs bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-600 hover:text-white transition shadow-sm hide-in-screenshot">انسحاب 🏃‍♂️</button>}
                                                    </div>
                                                </div>

                                                {isPlaying && (
                                                    <div className="mt-4 text-red-600 font-black text-[10px] sm:text-sm flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                                                        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-600 rounded-full animate-ping"></span>مباشر
                                                    </div>
                                                )}

                                                {/* 🔥 التايم لاين العمودي المفتوح للجمهور والإدمن 🔥 */}
                                                {match.matchEvents && match.matchEvents.length > 0 && (
                                                    <div className="mt-6 w-full px-2 sm:px-8 bg-gray-50/50 rounded-2xl py-4 border border-gray-100">
                                                        <h4 className="text-center font-black text-gray-500 mb-6 text-sm sm:text-base border-b border-gray-200 pb-2 w-max mx-auto">📜 مجريات المباراة</h4>
                                                        
                                                        <div className="relative w-full max-w-xl mx-auto py-2">
                                                            <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gray-200 transform -translate-x-1/2 rounded-full"></div>

                                                            {match.matchEvents.sort((a, b) => a.minute - b.minute).map((event, idx) => {
                                                                const isTeam1 = t1Players.some(p => p.id === event.playerId || p.Id === event.playerId);
                                                                const player = [...t1Players, ...t2Players].find(p => p.id === event.playerId || p.Id === event.playerId);
                                                                const icon = event.eventType === 'player-goal' ? '⚽' : event.eventType === 'yellow-card' ? '🟨' : '🟥';

                                                                return (
                                                                    <div key={idx} className="flex items-center justify-between w-full mb-6 relative z-10">
                                                                        <div className={`w-1/2 px-2 sm:px-6 flex justify-end ${!isTeam1 && 'invisible'}`}>
                                                                            {isTeam1 && (
                                                                                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-gray-700 bg-white px-2 py-1 shadow-sm rounded border border-gray-100">
                                                                                    <span>{player?.name || player?.Name}</span>
                                                                                    <span className="text-[12px] sm:text-xs">{icon}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-900 text-yellow-400 font-black flex items-center justify-center border-2 border-white shadow-sm text-[8px] sm:text-[9px] absolute left-1/2 transform -translate-x-1/2">
                                                                            {event.minute}'
                                                                        </div>

                                                                        <div className={`w-1/2 px-2 sm:px-6 flex justify-start ${isTeam1 && 'invisible'}`}>
                                                                            {!isTeam1 && (
                                                                                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-gray-700 bg-white px-2 py-1 shadow-sm rounded border border-gray-100">
                                                                                    <span className="text-[12px] sm:text-xs">{icon}</span>
                                                                                    <span>{player?.name || player?.Name}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ================= أدوات الإدمن ================= */}
                                                {isAdmin && !isPlaying && (
                                                    <div className="mt-6 flex flex-col items-center gap-4 w-full justify-center border-t border-gray-100 pt-5 hide-in-screenshot">
                                                        <button onClick={() => handleStartMatch(matchId)} className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-3 rounded-xl font-black hover:shadow-lg transition w-64 text-sm sm:text-base border border-green-700">▶️ بدء المباراة الآن</button>
                                                        {!match.isPostponed && (
                                                            <div className="mt-2 w-full flex justify-center">
                                                                {postponingMatchId === matchId ? (
                                                                    <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-xl flex flex-col gap-3 text-right w-full max-w-sm shadow-inner">
                                                                        <input type="text" placeholder="سبب التأجيل" value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} className="p-2 border rounded text-sm" />
                                                                        <input type="datetime-local" value={newMatchDate} onChange={(e) => setNewMatchDate(e.target.value)} className="p-2 border rounded text-sm" />
                                                                        <div className="flex gap-2">
                                                                            <button onClick={() => handleConfirmPostpone(matchId)} className="flex-1 bg-yellow-600 text-white font-bold py-2 rounded text-sm">حفظ</button>
                                                                            <button onClick={handleCancelPostpone} className="flex-1 bg-gray-300 text-gray-800 font-bold py-2 rounded text-sm">إلغاء</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => handleStartPostpone(match)} className="bg-yellow-50 text-yellow-700 border border-yellow-300 px-6 py-2 rounded-lg font-bold hover:bg-yellow-100 transition shadow-sm text-xs sm:text-sm">⏸️ تأجيل المباراة</button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {isAdmin && isPlaying && (
                                                    <div className="mt-6 w-full border-t border-gray-100 pt-6 hide-in-screenshot">
                                                        
                                                        {/* زراير الإيقاف والتشغيل المربوطة بالباك إند */}
                                                        <div className="flex flex-col items-center justify-center gap-2 mb-6">
                                                            <span className="text-gray-400 font-bold text-xs sm:text-sm">التحكم السريع في الوقت</span>
                                                            <button onClick={() => handleToggleTimer(matchId)} className={`px-6 py-2 rounded font-bold text-sm transition shadow-md border ${matchTimers[matchId]?.isRunning ? 'bg-orange-600 border-orange-700 hover:bg-orange-700 text-white' : 'bg-green-600 border-green-700 hover:bg-green-700 text-white'}`}>
                                                                {matchTimers[matchId]?.isRunning ? '⏸️ إيقاف مؤقت للعداد' : '▶️ استئناف الوقت'}
                                                            </button>
                                                        </div>

                                                        <h4 className="text-center font-bold text-gray-500 bg-gray-100 py-2 rounded-lg mb-4 text-xs sm:text-sm">سجل الأهداف والكروت 👇</h4>
                                                        
                                                        <div className="flex flex-col md:flex-row gap-4 w-full">
                                                            <div className="flex-1 bg-blue-50/50 p-2 sm:p-4 rounded-xl border border-blue-100 space-y-2 sm:space-y-3">
                                                                {t1Players.map(player => {
                                                                    const pId = player.id || player.Id;
                                                                    const events = match.matchEvents?.filter(e => e.playerId === pId) || [];
                                                                    const goals = events.filter(e => e.eventType === 'player-goal').length;
                                                                    const yellows = events.filter(e => e.eventType === 'yellow-card').length;
                                                                    const reds = events.filter(e => e.eventType === 'red-card').length;

                                                                    return (
                                                                        <div key={pId} className={`flex flex-col xl:flex-row items-center justify-between p-2 rounded-lg shadow-sm border gap-2 sm:gap-3 ${reds > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                                                                            <span className="font-bold text-[10px] sm:text-xs text-gray-800 flex-1 flex flex-wrap gap-1 items-center w-full">
                                                                                <span>{player.name || player.Name}</span>
                                                                                {goals > 0 && <span className="text-green-700 bg-green-100 px-1 py-0.5 rounded font-black">{goals} ⚽</span>}
                                                                                {yellows > 0 && <span className="text-yellow-700 bg-yellow-100 px-1 py-0.5 rounded font-black">{yellows} 🟨</span>}
                                                                                {reds > 0 && (
                                                                                    <span className="text-red-700 bg-red-100 px-1 py-0.5 rounded font-black flex items-center gap-1"> طرد 🟥 {redCardTimers[`${matchId}-${pId}`] > 0 && (<span className="bg-red-600 text-white px-1 rounded shadow-sm animate-pulse font-mono">{formatTime(redCardTimers[`${matchId}-${pId}`])}</span>)}</span>
                                                                                )}
                                                                            </span>
                                                                            <div className="flex gap-1 shrink-0">
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'player-goal')} className="bg-green-100 hover:bg-green-200 text-green-800 border border-green-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">⚽</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'remove-goal')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">❌</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'yellow-card')} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">🟨</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'red-card')} className="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">🟥</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>

                                                            <div className="flex-1 bg-blue-50/50 p-2 sm:p-4 rounded-xl border border-blue-100 space-y-2 sm:space-y-3">
                                                                {t2Players.map(player => {
                                                                    const pId = player.id || player.Id;
                                                                    const events = match.matchEvents?.filter(e => e.playerId === pId) || [];
                                                                    const goals = events.filter(e => e.eventType === 'player-goal').length;
                                                                    const yellows = events.filter(e => e.eventType === 'yellow-card').length;
                                                                    const reds = events.filter(e => e.eventType === 'red-card').length;

                                                                    return (
                                                                        <div key={pId} className={`flex flex-col xl:flex-row items-center justify-between p-2 rounded-lg shadow-sm border gap-2 sm:gap-3 ${reds > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'}`}>
                                                                            <span className="font-bold text-[10px] sm:text-xs text-gray-800 flex-1 flex flex-wrap gap-1 items-center w-full">
                                                                                <span>{player.name || player.Name}</span>
                                                                                {goals > 0 && <span className="text-green-700 bg-green-100 px-1 py-0.5 rounded font-black">{goals} ⚽</span>}
                                                                                {yellows > 0 && <span className="text-yellow-700 bg-yellow-100 px-1 py-0.5 rounded font-black">{yellows} 🟨</span>}
                                                                                {reds > 0 && (
                                                                                    <span className="text-red-700 bg-red-100 px-1 py-0.5 rounded font-black flex items-center gap-1"> طرد 🟥 {redCardTimers[`${matchId}-${pId}`] > 0 && (<span className="bg-red-600 text-white px-1 rounded shadow-sm animate-pulse font-mono">{formatTime(redCardTimers[`${matchId}-${pId}`])}</span>)}</span>
                                                                                )}
                                                                            </span>
                                                                            <div className="flex gap-1 shrink-0">
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'player-goal')} className="bg-green-100 hover:bg-green-200 text-green-800 border border-green-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">⚽</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'remove-goal')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">❌</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'yellow-card')} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">🟨</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'red-card')} className="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 px-2 py-1 rounded shadow-sm text-[10px] font-bold transition">🟥</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        <button onClick={() => handleFinishMatch(matchId)} className="w-full sm:w-64 mx-auto block bg-gradient-to-r from-red-600 to-rose-700 text-white px-8 py-3 rounded-xl font-black hover:shadow-lg transition mt-8 border border-red-800">
                                                            صافرة النهاية 🛑
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}

            {champion && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center p-4 animate-fade-in" dir="rtl">
                    <div className="bg-gradient-to-b from-yellow-400 via-amber-500 to-amber-600 p-1 rounded-3xl shadow-2xl max-w-lg w-full transform scale-100 transition-all animate-bounce-short">
                        <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col items-center relative overflow-hidden">
                            <div className="absolute -inset-10 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-full blur-xl animate-pulse pointer-events-none"></div>
                            <span className="absolute top-6 left-6 text-4xl animate-ping pointer-events-none">🎉</span>
                            <span className="absolute top-6 right-6 text-4xl animate-ping delay-300 pointer-events-none">🎊</span>
                            <span className="absolute bottom-10 left-10 text-3xl animate-bounce pointer-events-none">✨</span>
                            <span className="absolute bottom-10 right-10 text-3xl animate-bounce delay-150 pointer-events-none">⚽</span>
                            
                            <div className="text-7xl mb-6 bg-amber-500/10 p-6 rounded-full border border-yellow-400/30 animate-spin-slow relative z-10">🏆</div>
                            <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-200 uppercase tracking-widest mb-2 animate-pulse relative z-10">بطل البطولة رسمياً</h3>
                            <p className="text-sm text-gray-400 font-bold mb-6 relative z-10">اسدل الستار وانتهت الملحمة الكروية</p>
                            
                            <div className="bg-yellow-500 text-slate-950 font-black text-4xl px-8 py-4 rounded-2xl shadow-xl tracking-wide mb-8 border-2 border-white/50 animate-pulse relative z-10">
                                👑 {champion} 👑
                            </div>
                            
                            <button onClick={() => {setChampion(null); setActiveTab('standings');}} className="relative z-10 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-black hover:to-gray-900 text-white font-black px-8 py-3 rounded-xl border border-gray-600 transition shadow-lg w-full cursor-pointer">
                                إغلاق والعودة للوحة التحكم ✖️
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}