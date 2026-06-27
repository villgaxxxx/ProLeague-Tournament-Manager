import React, { useState, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';

export default function Matches({ setActiveTab }) {
    const [matches, setMatches] = useState([]);
    const [champion, setChampion] = useState(null);
    const isAdmin = !!localStorage.getItem('adminToken');
    
    // حالات التأجيل
    const [postponingMatchId, setPostponingMatchId] = useState(null);
    const [postponeReason, setPostponeReason] = useState("");
    const [newMatchDate, setNewMatchDate] = useState("");
    
    // ⏱️ حالات التايمرات
    const [matchTimers, setMatchTimers] = useState({}); 
    const [redCardTimers, setRedCardTimers] = useState({});

    // دالة جلب المباريات
    const fetchMatches = useCallback(() => {
        fetch('/api/Matches')
            .then(res => res.json())
            .then(data => setMatches(Array.isArray(data) ? data : data?.$values || []))
            .catch(err => console.error("Error fetching matches:", err));
    }, []);

    // 🔥 التعديل 1: ضفنا fetchMatches() هنا عشان الماتشات تظهر أول ما الصفحة تفتح 🔥
    useEffect(() => {
        fetchMatches(); // جلب الداتا فوراً
        
        const interval = setInterval(() => {
            // 1. تزويد وقت الماتشات الشغالة
            setMatchTimers(prev => {
                const newTimers = { ...prev };
                let updated = false;
                Object.keys(newTimers).forEach(matchId => {
                    if (newTimers[matchId].isRunning) {
                        newTimers[matchId] = { ...newTimers[matchId], elapsed: newTimers[matchId].elapsed + 1 };
                        updated = true;
                    }
                });
                return updated ? newTimers : prev;
            });

            // 2. تنقيص وقت كروت الطرد
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
        
        return () => clearInterval(interval);
    }, [fetchMatches]);

    // دالة تحويل الثواني لـ MM:SS
    const formatTime = (totalSeconds) => {
        if (!totalSeconds || totalSeconds < 0) return "00:00";
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // التحكم في التايمر يدوياً
    const toggleMatchTimer = (matchId, forceState = null) => {
        setMatchTimers(prev => {
            const current = prev[matchId] || { elapsed: 0, isRunning: false };
            const newState = forceState !== null ? forceState : !current.isRunning;
            return { ...prev, [matchId]: { ...current, isRunning: newState } };
        });
    };

    // 🔥 التعديل 2: ربط بدء الماتش بالتايمر 🔥
    const handleStartMatch = async (id) => {
        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Matches/${id}/start`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        toggleMatchTimer(id, true); // تشغيل العداد فوراً
        fetchMatches();
    };

    // 🔥 التعديل 3: ربط صافرة النهاية بإيقاف التايمر 🔥
    const handleFinishMatch = async (id) => {
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
            if (p1 === null || p1.trim() === "") return;
            const p2 = window.prompt(`⚽ أدخل عدد ضربات الترجيح الناجحة لفريق (${t2Name}):`);
            if (p2 === null || p2.trim() === "") return;
            const pen1 = parseInt(p1);
            const pen2 = parseInt(p2);
            if (pen1 === pen2) {
                alert("لا يمكن أن تنتهي ضربات الترجيح بالتعادل! أعد إدخال النتيجة النهائية. 🛑");
                return;
            }
            const winnerName = pen1 > pen2 ? t1Name : t2Name;
            const confirmFinish = window.confirm(`✅ تأكيد فوز (${winnerName}) بضربات الترجيح وإنهاء المباراة؟`);
            if (!confirmFinish) return;

            toggleMatchTimer(id, false); // إيقاف التايمر
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
        if (!confirmFinish) return;

        toggleMatchTimer(id, false); // إيقاف التايمر
        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/Matches/${id}/finish`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.championName || data.ChampionName) setChampion(data.championName || data.ChampionName);
        fetchMatches();
    };

    // دوال التأجيل والحذف
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
            else alert("حدث خطأ أثناء التأجيل.");
        } catch { alert("مشكلة في الاتصال بالسيرفر."); }
    };

    const handleDeleteMatch = async (matchId) => {
        const confirmDelete = window.confirm("⚠️ تحذير خطير: هل أنت متأكد من حذف هذه المباراة نهائياً؟");
        if (!confirmDelete) return;
        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch(`/api/Matches/${matchId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { alert("تم حذف المباراة بنجاح! 🗑️"); fetchMatches(); } 
            else alert("حدث خطأ أثناء الحذف.");
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
            if (res.ok) { alert('تم تسجيل الانسحاب! ⚖️✅'); fetchMatches(); } 
            else {
                const data = await res.json();
                alert(data.message || 'حدث خطأ أثناء تسجيل الانسحاب.');
            }
        } catch { alert('مشكلة في الاتصال بالسيرفر.'); }
    };

    // تسجيل الأهداف والكروت
    const actionPlayer = async (matchId, playerId, action) => {
        const token = localStorage.getItem('adminToken');
        const currentMatchSeconds = matchTimers[matchId]?.elapsed || 0;
        const currentMinute = Math.floor(currentMatchSeconds / 60) + 1;

        if (action === 'red-card') {
            setRedCardTimers(prev => ({ ...prev, [`${matchId}-${playerId}`]: 120 }));
        }

        await fetch(`/api/Matches/${matchId}/${action}/${playerId}?minute=${currentMinute}`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchMatches();
    };

    // تجميع المباريات النشطة
    const activeMatches = matches.filter(m => !(m.isFinished === true || m.IsFinished === true));
    const matchesByRound = activeMatches.reduce((acc, match) => {
        const type = match.matchType || match.MatchType;
        let roundKey = (type !== "Group" && type !== undefined) ? `${type} 🏆` : `الجولة ${match.roundNumber ?? match.RoundNumber ?? 1}`;
        if (!acc[roundKey]) acc[roundKey] = [];
        acc[roundKey].push(match);
        return acc;
    }, {});

    // تحميل الصورة والهدافيين
    const handleDownloadRoundImage = async (roundKey) => { /* دالة تحميل الصورة زي ما هي */ };
    const renderScorers = (scorersString) => {
        if (!scorersString) return null;
        const scorersArray = scorersString.split(',').filter(Boolean);
        if (scorersArray.length === 0) return null;
        const grouped = scorersArray.reduce((acc, name) => { acc[name] = (acc[name] || 0) + 1; return acc; }, {});
        return (
            <div className="flex flex-wrap justify-center gap-1 mt-1.5 text-[10px] sm:text-xs text-green-700 font-bold">
                {Object.entries(grouped).map(([name, count], idx) => (
                    <span key={idx} className="bg-green-50 px-1.5 py-0.5 rounded border border-green-200 shadow-sm flex items-center">
                        {name} <span className="ml-0.5 text-[8px] sm:text-[10px]">{"⚽".repeat(count)}</span>
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto mt-8 px-4 mb-16" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-10 text-gray-800">جدول مباريات البطولة 🗓️</h2>

            {Object.keys(matchesByRound).length === 0 ? (
                <p className="text-center text-gray-500 font-bold mb-10 text-xl">لا توجد مباريات جارية حالياً.</p>
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

                            <div id={safeId} className="p-4 rounded-3xl bg-gray-50/50">
                                <div className="flex items-center justify-center mb-8">
                                    <h3 className="text-2xl font-black bg-blue-950 text-white px-10 py-3 rounded-full shadow-lg border-4 border-blue-100 flex items-center gap-2">
                                        {!isNaN(roundKey) ? `⚽ الجولة رقم ${roundKey}` : `🏆 ${roundKey}`}
                                    </h3>
                                </div>

                                <div className="grid gap-6">
                                    {matchesByRound[roundKey].map(match => {
                                        const matchId = match.id || match.Id;
                                        const t1Players = Array.isArray(match.team1?.players) ? match.team1.players : (match.team1?.players?.$values || []);
                                        const t2Players = Array.isArray(match.team2?.players) ? match.team2.players : (match.team2?.players?.$values || []);
                                        const cardBg = match.isPostponed ? 'bg-gray-100 border-gray-400 opacity-80' : match.isPlaying ? 'bg-white border-red-500 shadow-red-50' : 'bg-white border-blue-500';

                                        return (
                                            <div key={matchId} className={`p-6 rounded-xl shadow-lg border-r-8 flex flex-col items-center transition-all relative ${cardBg}`}>
                                                
                                                {(match.groupName || match.GroupName) && (
                                                    <div className="absolute top-0 left-0 bg-blue-100 text-blue-800 px-3 py-1 text-xs font-bold rounded-br-lg">المجموعة {match.groupName || match.GroupName}</div>
                                                )}

                                                {isAdmin && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteMatch(matchId); }} className="absolute top-8 left-2 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white p-2 rounded-full shadow-sm z-10" title="حذف المباراة">
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                                    </button>
                                                )}

                                                <div className="text-sm text-gray-500 mb-2 bg-gray-200 px-4 py-1 rounded-full font-bold mt-2">
                                                    {match.matchDate && new Date(match.matchDate).getFullYear() > 2001 ? new Date(match.matchDate).toLocaleString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'لم يتم تحديد الموعد ⏳'}
                                                </div>

                                                {match.isPostponed && (
                                                    <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg font-black mt-2 text-center border border-red-300">🚫 مؤجلة: {match.postponeReason}</div>
                                                )}

                                                {/* عرض الفرق والنتيجة/التايمر */}
                                                <div className="flex justify-between items-center w-full mt-4 px-1 sm:px-4">
                                                    <div className="flex flex-col items-center flex-1">
                                                        <span className={`text-base sm:text-xl md:text-2xl font-black text-center ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>{match.team1?.name || match.Team1?.Name}</span>
                                                        {isAdmin && <button onClick={() => handleWithdraw(matchId, match.team1Id || match.Team1Id, match.team1?.name || match.Team1?.Name)} className="mt-2 text-xs bg-red-50 text-red-600 px-2 py-1 rounded shadow-sm">انسحاب 🏃‍♂️</button>}
                                                    </div>

                                                    <div className="shrink-0 mx-2 flex justify-center">
                                                        {match.isPlaying ? (
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <div className="flex items-center gap-2 sm:gap-3 bg-gray-100 text-gray-800 px-3 py-1 sm:px-5 sm:py-2 rounded-xl font-mono text-xl sm:text-3xl font-black border-2 border-gray-300 shadow-sm">
                                                                    <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
                                                                </div>
                                                                {/* ⏱️ التايمر الأحمر اللايف */}
                                                                <div className="bg-red-700 text-white px-3 py-0.5 rounded font-mono text-sm sm:text-lg font-black shadow-md animate-pulse border border-red-900 w-full text-center">
                                                                    ⏱️ {formatTime(matchTimers[matchId]?.elapsed)}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 font-black text-sm sm:text-xl bg-gray-200 px-3 py-1 rounded-lg">VS</span>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-col items-center flex-1">
                                                        <span className={`text-base sm:text-xl md:text-2xl font-black text-center ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>{match.team2?.name || match.Team2?.Name}</span>
                                                        {isAdmin && <button onClick={() => handleWithdraw(matchId, match.team2Id || match.Team2Id, match.team2?.name || match.Team2?.Name)} className="mt-2 text-xs bg-red-50 text-red-600 px-2 py-1 rounded shadow-sm">انسحاب 🏃‍♂️</button>}
                                                    </div>
                                                </div>

                                                {/* مباشر والهدافيين */}
                                                {match.isPlaying && <div className="mt-4 text-red-600 font-black text-sm flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full"><span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>مباشر</div>}
                                                <div className="flex justify-between items-start w-full px-1 sm:px-4 mt-2 mb-4">
                                                    <div className="flex-1 flex justify-center">{renderScorers(match.team1Scorers || match.Team1Scorers)}</div>
                                                    <div className="shrink-0 mx-2 w-[70px] xs:w-[85px] sm:w-[110px]"></div>
                                                    <div className="flex-1 flex justify-center">{renderScorers(match.team2Scorers || match.Team2Scorers)}</div>
                                                </div>

                                                {/* 🔥 التعديل 4: زراير بدء الماتش والتأجيل لو الماتش لسه مبدأش 🔥 */}
                                                {isAdmin && !match.isPlaying && (
                                                    <div className="mt-6 flex flex-col items-center gap-4 w-full justify-center border-t pt-4 hide-in-screenshot">
                                                        <button onClick={() => handleStartMatch(matchId)} className="bg-green-600 text-white px-8 py-3 rounded-lg font-black hover:bg-green-700 transition shadow-lg w-64">▶️ بدء المباراة الان</button>
                                                        
                                                        {/* إعدادات التأجيل */}
                                                        {!match.isPostponed && (
                                                            <div className="mt-2 w-full flex justify-center">
                                                                {postponingMatchId === matchId ? (
                                                                    <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-xl flex flex-col gap-3 animate-fade-in text-right w-full max-w-sm shadow-inner">
                                                                        <input type="text" placeholder="سبب التأجيل..." value={postponeReason} onChange={(e) => setPostponeReason(e.target.value)} className="p-2 border rounded" />
                                                                        <input type="datetime-local" value={newMatchDate} onChange={(e) => setNewMatchDate(e.target.value)} className="p-2 border rounded" />
                                                                        <div className="flex gap-2">
                                                                            <button onClick={() => handleConfirmPostpone(matchId)} className="flex-1 bg-yellow-600 text-white font-bold py-2 rounded">حفظ</button>
                                                                            <button onClick={handleCancelPostpone} className="flex-1 bg-gray-300 font-bold py-2 rounded">إلغاء</button>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <button onClick={() => handleStartPostpone(match)} className="bg-yellow-500 text-yellow-900 px-6 py-2 rounded-lg font-bold hover:bg-yellow-600 shadow">⏸️ تأجيل</button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ==================== لوحة الإدمن للماتش اللايف ==================== */}
                                                {isAdmin && match.isPlaying && (
                                                    <div className="mt-6 w-full border-t border-gray-100 pt-6 hide-in-screenshot">
                                                        <div className="bg-gray-900 text-white p-4 sm:p-6 rounded-xl shadow-lg mb-8 border-t-4 border-yellow-500 w-full flex flex-col md:flex-row gap-6">
                                                            <div className="flex flex-col items-center gap-3 shrink-0 bg-gray-800 p-4 rounded-lg border border-gray-700 w-full md:w-1/3">
                                                                <span className="text-gray-400 font-bold text-sm">التحكم في الوقت</span>
                                                                <div className="font-mono text-4xl font-black text-yellow-400">{formatTime(matchTimers[matchId]?.elapsed)}</div>
                                                                <button onClick={() => toggleMatchTimer(matchId)} className={`w-full py-2 rounded font-bold transition ${matchTimers[matchId]?.isRunning ? 'bg-orange-600' : 'bg-green-600'}`}>
                                                                    {matchTimers[matchId]?.isRunning ? '⏸️ إيقاف مؤقت' : '▶️ استئناف الوقت'}
                                                                </button>
                                                            </div>

                                                            <div className="flex-1 w-full bg-gray-800 rounded-lg p-3 border border-gray-700 max-h-[180px] overflow-y-auto custom-scrollbar">
                                                                <p className="text-xs text-gray-400 font-bold sticky top-0 bg-gray-800 z-10 pb-2 border-b border-gray-700">📜 مجريات المباراة:</p>
                                                                <div className="flex flex-col gap-2 mt-2">
                                                                    {(!match.matchEvents || match.matchEvents.length === 0) ? (
                                                                        <span className="text-gray-500 text-sm text-center block mt-4">لم يتم تسجيل أحداث بعد...</span>
                                                                    ) : (
                                                                        match.matchEvents?.sort((a, b) => b.minute - a.minute).map((event, idx) => {
                                                                            const icon = event.eventType === 'player-goal' ? '⚽' : event.eventType === 'yellow-card' ? '🟨' : '🟥';
                                                                            const player = [...t1Players, ...t2Players].find(p => p.id === event.playerId || p.Id === event.playerId);
                                                                            return (
                                                                                <div key={idx} className="bg-gray-700 px-3 py-2 rounded-md flex justify-between text-sm">
                                                                                    <div className="flex gap-2"><span>{icon}</span><span className="font-bold text-white">{player?.name || player?.Name}</span></div>
                                                                                    <span className="text-yellow-400 font-black">{event.minute}'</span>
                                                                                </div>
                                                                            );
                                                                        })
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <h4 className="text-center font-bold text-gray-500 bg-gray-100 py-2 rounded-lg mb-4">سجل الأهداف والكروت 👇</h4>
                                                        <div className="flex flex-col md:flex-row gap-4 w-full">
                                                            {/* فريق 1 */}
                                                            <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                                                {t1Players.map(player => {
                                                                    const pId = player.id || player.Id;
                                                                    const events = match.matchEvents?.filter(e => e.playerId === pId) || [];
                                                                    const goals = events.filter(e => e.eventType === 'player-goal').length;
                                                                    const reds = events.filter(e => e.eventType === 'red-card').length;
                                                                    return (
                                                                        <div key={pId} className="flex flex-col xl:flex-row items-center justify-between p-2 bg-white rounded-lg shadow-sm border gap-3">
                                                                            <span className="font-bold text-sm flex-1 flex flex-wrap gap-1">
                                                                                {player.name || player.Name}
                                                                                {goals > 0 && <span className="text-green-700 bg-green-100 px-1 rounded">{goals} ⚽</span>}
                                                                                {reds > 0 && (
                                                                                    <span className="text-red-700 bg-red-100 px-1 rounded flex gap-1">
                                                                                        طرد 🟥 {redCardTimers[`${matchId}-${pId}`] > 0 && <span className="bg-red-600 text-white px-1 rounded animate-pulse">{formatTime(redCardTimers[`${matchId}-${pId}`])}</span>}
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                            <div className="flex gap-1 shrink-0">
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'player-goal')} className="bg-green-100 px-2 py-1 rounded text-xs">⚽</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'remove-goal')} className="bg-gray-100 px-2 py-1 rounded text-xs">❌</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'yellow-card')} className="bg-yellow-100 px-2 py-1 rounded text-xs">🟨</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'red-card')} className="bg-red-100 px-2 py-1 rounded text-xs">🟥</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                            {/* فريق 2 */}
                                                            <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                                                {t2Players.map(player => {
                                                                    const pId = player.id || player.Id;
                                                                    const events = match.matchEvents?.filter(e => e.playerId === pId) || [];
                                                                    const goals = events.filter(e => e.eventType === 'player-goal').length;
                                                                    const reds = events.filter(e => e.eventType === 'red-card').length;
                                                                    return (
                                                                        <div key={pId} className="flex flex-col xl:flex-row items-center justify-between p-2 bg-white rounded-lg shadow-sm border gap-3">
                                                                            <span className="font-bold text-sm flex-1 flex flex-wrap gap-1">
                                                                                {player.name || player.Name}
                                                                                {goals > 0 && <span className="text-green-700 bg-green-100 px-1 rounded">{goals} ⚽</span>}
                                                                                {reds > 0 && (
                                                                                    <span className="text-red-700 bg-red-100 px-1 rounded flex gap-1">
                                                                                        طرد 🟥 {redCardTimers[`${matchId}-${pId}`] > 0 && <span className="bg-red-600 text-white px-1 rounded animate-pulse">{formatTime(redCardTimers[`${matchId}-${pId}`])}</span>}
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                            <div className="flex gap-1 shrink-0">
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'player-goal')} className="bg-green-100 px-2 py-1 rounded text-xs">⚽</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'remove-goal')} className="bg-gray-100 px-2 py-1 rounded text-xs">❌</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'yellow-card')} className="bg-yellow-100 px-2 py-1 rounded text-xs">🟨</button>
                                                                                <button onClick={() => actionPlayer(matchId, pId, 'red-card')} className="bg-red-100 px-2 py-1 rounded text-xs">🟥</button>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                        <button onClick={() => handleFinishMatch(matchId)} className="w-64 mx-auto block bg-red-600 text-white px-8 py-3 rounded-xl font-black hover:bg-red-700 mt-6">صافرة النهاية 🛑</button>
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

            {/* بوب أب البطل */}
            {champion && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 text-white p-8 rounded-3xl text-center border-4 border-yellow-500 shadow-2xl">
                        <div className="text-7xl mb-4 animate-bounce">🏆</div>
                        <h3 className="text-3xl font-black text-yellow-400 mb-6">بطل البطولة رسمياً</h3>
                        <div className="bg-yellow-500 text-black text-4xl px-8 py-4 rounded-xl font-black mb-6">👑 {champion} 👑</div>
                        <button onClick={() => { setChampion(null); setActiveTab('standings'); }} className="bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded-lg font-bold">إغلاق ✖️</button>
                    </div>
                </div>
            )}
        </div>
    );
}