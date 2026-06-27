import { useState, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';

export default function Matches({ setActiveTab }) {
    const [matches, setMatches] = useState([]);
    const [champion, setChampion] = useState(null);
    const isAdmin = !!localStorage.getItem('adminToken');
    const [postponingMatchId, setPostponingMatchId] = useState(null);
    const [postponeReason, setPostponeReason] = useState("");
    const [newMatchDate, setNewMatchDate] = useState("");
    const [secondsElapsed, setSecondsElapsed] = useState(0); // العداد بالثواني
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [matchTimers, setMatchTimers] = useState({}); 
    const [redCardTimers, setRedCardTimers] = useState({});

    const fetchMatches = useCallback(() => {
        fetch('/api/Matches')
            .then(res => res.json())
            .then(data => setMatches(Array.isArray(data) ? data : data?.$values || []))
            .catch(err => console.error("Error fetching matches:", err));
    }, []);

    // 🔥 التعديل هنا: نظفنا الـ useEffect المتكررة ودمجنا البولينج بشكل سليم
    useEffect(() => {
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

        // 2. تنقيص وقت كروت الطرد (الدقيقتين)
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
}, []);

// دالة تحويل الثواني لشكل MM:SS
const formatTime = (totalSeconds) => {
    if (!totalSeconds || totalSeconds < 0) return "00:00";
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
};

    const handleStartMatch = async (id) => {
        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Matches/${id}/start`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchMatches();
    };

    const handleStartPostpone = (match) => {
    setPostponingMatchId(match.id || match.Id);
    setPostponeReason(match.postponeReason || match.PostponeReason || "");
    
    // تظبيط التاريخ القديم عشان يتعرض في الخانة
    const mDate = match.matchDate || match.MatchDate;
    const formattedDate = mDate ? new Date(mDate).toISOString().slice(0, 16) : "";
    setNewMatchDate(formattedDate);
};

// دالة للإلغاء لو قفل الخانات
const handleCancelPostpone = () => {
    setPostponingMatchId(null);
    setPostponeReason("");
    setNewMatchDate("");
};

// دالة الحفظ
const handleConfirmPostpone = async (matchId) => {
    if (!postponeReason || !newMatchDate) {
        return alert("يرجى إدخال سبب التأجيل والموعد الجديد!");
    }

    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(`/api/Matches/${matchId}/postpone`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                Reason: postponeReason,
                NewDate: new Date(newMatchDate).toISOString()
            })
        });

        if (res.ok) {
            setPostponingMatchId(null); // اقفل الخانات
            fetchMatches(); // حدّث الماتشات
        } else {
            alert("حدث خطأ أثناء التأجيل.");
        }
    } catch (error) {
        alert("مشكلة في الاتصال بالسيرفر.");
    }
};

const handleDeleteMatch = async (matchId) => {
    const confirmDelete = window.confirm("⚠️ تحذير خطير: هل أنت متأكد من حذف هذه المباراة نهائياً من البطولة؟\nلا يمكن التراجع عن هذه الخطوة!");
    if (!confirmDelete) return;

    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch(`/api/Matches/${matchId}`, {
            method: 'DELETE',
            headers: { 
                'Authorization': `Bearer ${token}` 
            }
        });

        if (res.ok) {
            alert("تم حذف المباراة بنجاح! 🗑️");
            fetchMatches(); // تحديث قائمة المباريات في الشاشة فوراً
        } else {
            alert("حدث خطأ أثناء حذف المباراة من السيرفر.");
        }
    } catch (error) {
        console.error("Delete Match Error:", error);
        alert("مشكلة في الاتصال بالسيرفر.");
    }
};

const actionPlayer = async (matchId, playerId, action) => {
    const token = localStorage.getItem('adminToken');
    
    // 1. حساب الدقيقة الحالية من وقت الماتش ده تحديداً (بدل secondsElapsed القديمة)
    const currentMatchSeconds = matchTimers[matchId]?.elapsed || 0;
    const currentMinute = Math.floor(currentMatchSeconds / 60) + 1;

    // 2. 🔥 تشغيل عداد الطرد (دقيقتين = 120 ثانية) لو الأكشن كان كارت أحمر 🔥
    if (action === 'red-card') {
        setRedCardTimers(prev => ({
            ...prev,
            [`${matchId}-${playerId}`]: 120
        }));
    }

    // 3. بعتنا الدقيقة للسيرفر في الرابط عشان تتسجل في التايم لاين
    await fetch(`/api/Matches/${matchId}/${action}/${playerId}?minute=${currentMinute}`, {
        method: 'PUT', 
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // 4. تحديث الشاشة
    fetchMatches();
};

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
                alert("لا يمكن أن تنتهي ضربات الترجيح بالتعادل! أعد إدخال النتيجة النهائية للركلات. 🛑");
                return;
            }

            const winnerName = pen1 > pen2 ? t1Name : t2Name;
            const confirmFinish = window.confirm(`✅ تأكيد فوز (${winnerName}) بضربات الترجيح وإنهاء المباراة؟`);
            if (!confirmFinish) return;

            const token = localStorage.getItem('adminToken');
            const response = await fetch(`/api/Matches/${id}/finish-knockout`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ team1Penalties: pen1, team2Penalties: pen2 })
            });
            const data = await response.json();
            if (data.championName || data.ChampionName) {
                setChampion(data.championName || data.ChampionName);
            }
            fetchMatches();
            return;
        }

        const confirmFinish = window.confirm("هل أنت متأكد من إنهاء المباراة بالنتيجة الحالية؟ 🛑");
        if (!confirmFinish) return;

        const token = localStorage.getItem('adminToken');
        const response = await fetch(`/api/Matches/${id}/finish`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.championName || data.ChampionName) {
            setChampion(data.championName || data.ChampionName);
        }
        fetchMatches();
    };

    const activeMatches = matches.filter(m => !(m.isFinished === true || m.IsFinished === true));

    const matchesByRound = activeMatches.reduce((acc, match) => {
    const type = match.matchType || match.MatchType;
    let roundKey = "";

    if (type !== "Group" && type !== undefined) {
        // 🔥 هنا السحر: هناخد الاسم الحقيقي من الداتا بيز ونحط جنبه الكأس
        roundKey = `${type} 🏆`; 
    } else {
        const round = match.roundNumber ?? match.RoundNumber ?? 1;
        roundKey = `الجولة ${round}`;
    }

    if (!acc[roundKey]) acc[roundKey] = [];
    acc[roundKey].push(match);
    return acc;
}, {});

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

            const dataUrl = await toPng(element, {
                quality: 1.0,
                pixelRatio: 2,
                filter: (node) => {
                    if (node?.classList?.contains('hide-in-screenshot')) {
                        return false;
                    }
                    return true;
                }
            });

            element.style.backgroundColor = originalBg;
            element.style.padding = originalPadding;
            element.style.borderRadius = originalRadius;

            const link = document.createElement('a');
            link.download = `${roundKey}-مباريات.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("حدث خطأ أثناء التقاط الصورة:", error);
            alert("حدث خطأ أثناء تجهيز الصورة، يرجى المحاولة مرة أخرى.");
        }
    };

    // ⚽ دالة تجميع وعرض الهدافين بشكل شيك ⚽
    const renderScorers = (scorersString) => {
        if (!scorersString) return null;
        
        // بنفصل الأسماء ونفلترها من الفراغات
        const scorersArray = scorersString.split(',').filter(Boolean);
        if (scorersArray.length === 0) return null;

        // بنجمع الأهداف لكل لاعب (عشان لو جاب هدفين نعرض كورتين)
        const grouped = scorersArray.reduce((acc, name) => {
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});

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

    const handleWithdraw = async (matchId, withdrawingTeamId, teamName) => {
    const confirmWithdraw = window.confirm(`🚨 تحذير خطير: هل أنت متأكد من انسحاب فريق "${teamName}"؟\nستنتهي المباراة فوراً بنتيجة 3-0 للفريق الآخر ولن يمكن التراجع!`);
    if (!confirmWithdraw) return;

    const token = localStorage.getItem('adminToken');
    try {
        // 🔥 التعديل هنا: المسار اتعدل عشان يطابق الباك إند بالظبط 🔥
        const res = await fetch(`/api/Matches/${matchId}/withdraw`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(withdrawingTeamId) 
        });

        if (res.ok) {
            alert('تم تسجيل الانسحاب وإغلاق المباراة بنجاح! ⚖️✅');
            // لو الدالة بتاعتك اللي بتجيب الماتشات اسمها مختلف، غير fetchMatches لاسمها
            fetchMatches(); 
        } else {
            // حماية عشان لو السيرفر رجع إيرور 404 أو 500 ميضربش إيرور الـ JSON
            const text = await res.text();
            try {
                const data = JSON.parse(text);
                alert(data.message || data.Message || 'حدث خطأ أثناء تسجيل الانسحاب.');
            } catch {
                alert('حدث خطأ في السيرفر أو المسار غير صحيح.');
            }
        }
    } catch (error) {
        console.error("Withdraw Error:", error);
        alert('مشكلة في الاتصال بالسيرفر.');
    }
};

const toggleMatchTimer = (matchId, forceState = null) => {
    setMatchTimers(prev => {
        const current = prev[matchId] || { elapsed: 0, isRunning: false };
        const newState = forceState !== null ? forceState : !current.isRunning;
        return { ...prev, [matchId]: { ...current, isRunning: newState } };
    });
};

    

    return (
        <div className="max-w-5xl mx-auto mt-8 px-4 mb-16" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-10 text-gray-800">جدول مباريات البطولة 🗓️</h2>

            {Object.keys(matchesByRound).length === 0 ? (
                <p className="text-center text-gray-500 font-bold mb-10 text-xl">لم يتم سحب القرعة أو توليد المباريات بعد.</p>
            ) : (
                Object.keys(matchesByRound).map(roundKey => {
                    const safeId = `capture-${roundKey.replace(/\s+/g, '-')}`;

                    return (
                        <div key={roundKey} className="mb-14 relative">
                            
                            {isAdmin && (
                                <div className="flex justify-end mb-4 px-2">
                                    <button 
                                        onClick={() => handleDownloadRoundImage(roundKey)}
                                        className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-2 rounded-xl font-bold hover:shadow-lg transition transform hover:-translate-y-1 text-sm border-2 border-indigo-200"
                                    >
                                        <span>📸</span> تحميل جدول {roundKey}
                                    </button>
                                </div>
                            )}

                            <div id={safeId} className="p-4 rounded-3xl bg-gray-50/50">
                                
                                <div className="flex items-center justify-center mb-8">
    <h3 className="text-2xl font-black bg-blue-950 text-white px-10 py-3 rounded-full shadow-lg border-4 border-blue-100 flex items-center gap-2">
        {/* لو الجولة عبارة عن رقم هيحط قبلها كلمة الجولة، ولو نص (زي ربع النهائي) هيعرضه زي ما هو */}
        {!isNaN(roundKey) ? `⚽ الجولة رقم ${roundKey}` : `🏆 ${roundKey}`}
    </h3>
</div>

                                <div className="grid gap-6">
                                    {matchesByRound[roundKey].map(match => {
                                        const isFinished = match.isFinished === true || match.IsFinished === true;
                                        
                                        if (isFinished) {
                                            const pen1 = match.team1PenaltiesScore ?? match.Team1PenaltiesScore;
                                            const pen2 = match.team2PenaltiesScore ?? match.Team2PenaltiesScore;

                                            return (
                                                <div key={match.id || match.Id} className="bg-white p-6 rounded-xl shadow-md border-r-8 border-gray-400 flex flex-col transition-all hover:shadow-lg relative overflow-hidden">
                                                    {(match.groupName || match.GroupName) && (
                                                        <div className="absolute top-0 left-0 bg-gray-200 text-gray-700 px-3 py-1 text-xs font-bold rounded-br-lg">
                                                            المجموعة {match.groupName || match.GroupName}
                                                        </div>
                                                    )}

                                                    {/* 🗑️ زرار حذف المباراة (تحت شريط المجموعة بشوية) 🗑️ */}
    {isAdmin && (
        <button
            onClick={(e) => {
                e.stopPropagation(); 
                handleDeleteMatch(match.id || match.Id);
            }}
            className="absolute top-8 left-2 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white p-2 rounded-full transition-all shadow-sm z-10 border border-transparent hover:border-red-700"
            title="حذف المباراة نهائياً"
        >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
        </button>
    )}

                                                    <div className="flex justify-between items-center w-full px-1 sm:px-4 mt-6">
                                                        <span className="flex-1 text-center font-black text-gray-700 leading-tight px-1 break-words text-xs xs:text-sm sm:text-base md:text-xl lg:text-2xl">
                                                            {match.team1?.name || match.Team1?.Name}
                                                        </span>
                                                        
                                                        <div className="flex flex-col items-center shrink-0 mx-1 xs:mx-2">
                                                            <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 bg-gray-100 text-gray-800 font-black shadow-inner font-mono rounded-lg xs:rounded-xl px-2 xs:px-3 sm:px-5 py-1 xs:py-1.5 sm:py-2 text-lg xs:text-xl sm:text-2xl md:text-3xl">
                                                                <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
                                                            </div>
                                                            {pen1 !== null && pen1 !== undefined && (
                                                                <span className="font-bold text-orange-600 mt-0.5 text-[9px] xs:text-[10px] sm:text-xs">ترجيح: ({pen1}) - ({pen2})</span>
                                                            )}
                                                        </div>
                                                        
                                                        <span className="flex-1 text-center font-black text-gray-700 leading-tight px-1 break-words text-xs xs:text-sm sm:text-base md:text-xl lg:text-2xl">
                                                            {match.team2?.name || match.Team2?.Name}
                                                        </span>
                                                    </div>

                                                    {(match.matchSummary || match.MatchSummary) && (
                                                        <div className="mt-5 bg-indigo-50 border-r-4 border-indigo-500 p-4 rounded-l-lg shadow-sm relative overflow-hidden group hide-in-screenshot">
                                                            <div className="absolute -left-4 -top-4 text-indigo-100 opacity-50 text-6xl transform -rotate-12 transition group-hover:scale-110 group-hover:rotate-0 duration-300">🎙️</div>
                                                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                                                <span className="text-xl">🤖</span>
                                                                <span className="text-sm font-black text-indigo-800 tracking-wide uppercase">تحليل المعلق الذكي (AI):</span>
                                                            </div>
                                                            <p className="text-base font-bold text-gray-700 leading-relaxed italic relative z-10">
                                                                "{match.matchSummary || match.MatchSummary}"
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        else {
                                            const t1Players = Array.isArray(match.team1?.players) ? match.team1.players : (match.team1?.players?.$values || []);
                                            const t2Players = Array.isArray(match.team2?.players) ? match.team2.players : (match.team2?.players?.$values || []);
                                            const cardBg = match.isPostponed ? 'bg-gray-100 border-gray-400 opacity-80' : 
                                                           match.isPlaying ? 'bg-white border-red-500 shadow-red-50' : 'bg-white border-blue-500';

                                            return (
                                                <div key={match.id || match.Id} className={`p-6 rounded-xl shadow-lg border-r-8 flex flex-col items-center transition-all relative ${cardBg}`}>
                                                    
                                                    {(match.groupName || match.GroupName) && (
                                                        <div className="absolute top-0 left-0 bg-blue-100 text-blue-800 px-3 py-1 text-xs font-bold rounded-br-lg">
                                                            المجموعة {match.groupName || match.GroupName}
                                                        </div>
                                                    )}

                                                    <div className="text-sm text-gray-500 mb-2 bg-gray-200 px-4 py-1 rounded-full font-bold mt-2">
                                                        {match.matchDate && new Date(match.matchDate).getFullYear() > 2001 
                                                            ? new Date(match.matchDate).toLocaleString('ar-EG', { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                            : 'لم يتم تحديد الموعد بعد ⏳'
                                                        }
                                                    </div>

                                                    {match.isPostponed && (
                                                        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg font-black mt-2 text-center border border-red-300">
                                                            🚫 المباراة مؤجلة: {match.postponeReason}
                                                        </div>
                                                    )}

                                                   <div className="flex justify-between items-center w-full mt-4 px-1 sm:px-4">
    
    {/* 👇 الجزء الخاص بالفريق الأول 👇 */}
    <div className="flex flex-col items-center flex-1">
        <span className={`text-base sm:text-xl md:text-2xl font-black text-center break-words px-1 ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>
            {match.team1?.name || match.Team1?.Name || "فريق 1"}
        </span>
        {/* زرار الانسحاب */}
        {isAdmin && (
            <button
                onClick={(e) => {
                    e.stopPropagation(); // عشان لو الكارت كله كليكابل ميفتحش الماتش
                    const teamId = match.team1Id || match.Team1Id || match.team1?.id || match.Team1?.Id;
                    const teamName = match.team1?.name || match.Team1?.Name;
                    handleWithdraw(match.id || match.Id, teamId, teamName);
                }}
                className="mt-2 text-[10px] sm:text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-2 py-1 rounded font-bold transition shadow-sm z-10"
                title="تسجيل انسحاب هذا الفريق"
            >
                انسحاب 🏃‍♂️
            </button>
        )}
    </div>

    {/* 👇 الجزء الخاص بالنتيجة أو علامة VS 👇 */}
<div className="shrink-0 mx-2 flex justify-center">
    {match.isPlaying ? (
        <div className="flex flex-col items-center gap-1.5">
            {/* النتيجة */}
            <div className="flex items-center gap-2 sm:gap-3 bg-red-600 text-white px-3 py-1 sm:px-5 sm:py-2 rounded-xl font-mono text-xl sm:text-3xl font-black shadow-md">
                <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
            </div>
            {/* ⏱️ التايمر اللايف الأحمر (ده اللي كان مختفي) */}
            <div className="bg-red-700 text-white px-3 py-0.5 rounded font-mono text-sm sm:text-lg font-black shadow-md animate-pulse border border-red-900 w-full text-center">
                ⏱️ {formatTime(matchTimers[match.id || match.Id]?.elapsed)}
            </div>
        </div>
    ) : (
        <span className="text-gray-400 font-black text-sm sm:text-xl bg-gray-200 px-3 py-1 rounded-lg">VS</span>
    )}
</div>

    {/* 👇 الجزء الخاص بالفريق الثاني 👇 */}
    <div className="flex flex-col items-center flex-1">
        <span className={`text-base sm:text-xl md:text-2xl font-black text-center break-words px-1 ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>
            {match.team2?.name || match.Team2?.Name || "فريق 2"}
        </span>
        {/* زرار الانسحاب */}
        {isAdmin && (
            <button
                onClick={(e) => {
                    e.stopPropagation(); // لمنع تداخل الكليكات
                    const teamId = match.team2Id || match.Team2Id || match.team2?.id || match.Team2?.Id;
                    const teamName = match.team2?.name || match.Team2?.Name;
                    handleWithdraw(match.id || match.Id, teamId, teamName);
                }}
                className="mt-2 text-[10px] sm:text-xs bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white px-2 py-1 rounded font-bold transition shadow-sm z-10"
                title="تسجيل انسحاب هذا الفريق"
            >
                انسحاب 🏃‍♂️
            </button>
        )}
    </div>
</div>

                                                    {match.isPlaying && (
                                                        <div className="mt-4 text-red-600 font-black text-sm flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                                                            <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>مباشر
                                                        </div>
                                                    )}

                                                    {/* 🔥 عرض الهدافين للجمهور تحت الفرق مباشرة 🔥 */}
{((match.team1Scorers && match.team1Scorers !== "") || (match.team2Scorers && match.team2Scorers !== "") || (match.Team1Scorers && match.Team1Scorers !== "") || (match.Team2Scorers && match.Team2Scorers !== "")) && (
    <div className="flex justify-between items-start w-full px-1 sm:px-4 mt-2 mb-4">
        
        {/* هدافي الفريق الأول */}
        <div className="flex-1 flex justify-center text-center">
            {renderScorers(match.team1Scorers || match.Team1Scorers)}
        </div>
        
        {/* مساحة فاضية تحت النتيجة عشان التوازن */}
        <div className="shrink-0 mx-2 w-[70px] xs:w-[85px] sm:w-[110px]"></div>
        
        {/* هدافي الفريق الثاني */}
        <div className="flex-1 flex justify-center text-center">
            {renderScorers(match.team2Scorers || match.Team2Scorers)}
        </div>
        
    </div>
)}




                                                    {isAdmin && !match.isPlaying && (
                                                        <div className="mt-6 flex gap-4 w-full justify-center border-t pt-4 hide-in-screenshot">
                                                            <button onClick={() => handleStartMatch(match.id || match.Id)} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition shadow">
                                                                ▶️ بدء المباراة
                                                            </button>
                                                            {!match.isPostponed && (
    <div className="mt-2 w-full flex justify-center">
        {postponingMatchId === (match.id || match.Id) ? (
            /* 👇 الخانات اللي بتفتح مكان الزرار (واخدة نفس درجات الأصفر عشان تليق مع ستايلك) 👇 */
            <div className="bg-yellow-50 border border-yellow-300 p-4 rounded-xl flex flex-col gap-3 animate-fade-in text-right w-full max-w-sm shadow-inner">
                <p className="text-yellow-900 font-black text-sm text-center border-b border-yellow-200 pb-2">⏳ إعدادات التأجيل:</p>
                
                <div>
                    <label className="block text-xs font-bold text-yellow-900 mb-1">سبب التأجيل:</label>
                    <input 
                        type="text" 
                        placeholder="مثال: سوء الأحوال الجوية..."
                        value={postponeReason}
                        onChange={(e) => setPostponeReason(e.target.value)}
                        className="w-full p-2 border border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none font-bold text-sm bg-white"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-yellow-900 mb-1">الموعد الجديد:</label>
                    <input 
                        type="datetime-local" 
                        value={newMatchDate}
                        onChange={(e) => setNewMatchDate(e.target.value)}
                        className="w-full p-2 border border-yellow-400 rounded-lg focus:ring-2 focus:ring-yellow-600 outline-none font-bold text-sm text-left bg-white"
                        dir="ltr"
                    />
                </div>

                <div className="flex gap-2 mt-2">
                    <button 
                        onClick={() => handleConfirmPostpone(match.id || match.Id)}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-black py-2 rounded-lg text-sm transition shadow-sm"
                    >
                        حفظ ✔️
                    </button>
                    <button 
                        onClick={handleCancelPostpone}
                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-black py-2 rounded-lg text-sm transition shadow-sm"
                    >
                        إلغاء ❌
                    </button>
                </div>
            </div>
        ) : (
            /* 👇 الزرار بتاعك الأصلي بنفس الستايل بالمللي 👇 */
            <button 
                onClick={() => handleStartPostpone(match)} 
                className="bg-yellow-500 text-yellow-900 px-6 py-2 rounded-lg font-bold hover:bg-yellow-600 transition shadow"
            >
                ⏸️ تأجيل
            </button>
        )}
    </div>
)}
                                                        </div>
                                                    )}

                                                    {isAdmin && match.isPlaying && (
    <div className="mt-6 w-full border-t border-gray-100 pt-6 hide-in-screenshot">
        
        {/* ========================================================= */}
        {/* ⏱️ لوحة تحكم وقت المباراة والتايم لاين (للإدمن فقط) ⏱️ */}
        <div className="bg-gray-900 text-white p-4 sm:p-6 rounded-xl shadow-lg mb-8 border-t-4 border-yellow-500 w-full flex flex-col md:flex-row gap-6">
            
            {/* أزرار التحكم في التايمر */}
            <div className="flex flex-col items-center justify-center gap-3 shrink-0 bg-gray-800 p-4 rounded-lg border border-gray-700 w-full md:w-1/3">
                <span className="text-gray-400 font-bold text-sm">التحكم في الوقت</span>
                <div className="font-mono text-4xl sm:text-5xl font-black text-yellow-400 drop-shadow-md">
                    {/* بيقرأ الوقت من Object الماتشات عشان لو في كذا ماتش شغالين مع بعض */}
                    {formatTime(matchTimers[match.id || match.Id]?.elapsed)}
                </div>
                <div className="flex gap-2 w-full mt-2">
                    <button 
                        onClick={() => toggleMatchTimer(match.id || match.Id)} 
                        className={`flex-1 py-2 rounded font-bold text-sm sm:text-base transition shadow-md ${matchTimers[match.id || match.Id]?.isRunning ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}`}
                    >
                        {matchTimers[match.id || match.Id]?.isRunning ? '⏸️ إيقاف مؤقت' : '▶️ استئناف الوقت'}
                    </button>
                </div>
            </div>

           {/* 📜 التايم لاين (عمودي + Scrollbar) */}
<div className="flex-1 w-full bg-gray-800 rounded-lg p-3 border border-gray-700 shadow-inner max-h-[180px] overflow-y-auto custom-scrollbar">
    <p className="text-xs text-gray-400 font-bold mb-2 sticky top-0 bg-gray-800 z-10 pb-2 border-b border-gray-700">📜 مجريات المباراة:</p>
    
    {/* 🔥 السر هنا في كلمة flex-col عشان تجيبه بالطول 🔥 */}
    <div className="flex flex-col gap-2 mt-2">
        {(!match.matchEvents || match.matchEvents.length === 0) ? (
            <span className="text-gray-500 text-sm italic text-center block mt-4">لم يتم تسجيل أحداث بعد... ⏱️</span>
        ) : (
            match.matchEvents?.sort((a, b) => b.minute - a.minute).map((event, idx) => {
                const icon = event.eventType === 'player-goal' ? '⚽' : event.eventType === 'yellow-card' ? '🟨' : '🟥';
                const player = [...(t1Players || []), ...(t2Players || [])].find(p => p.id === event.playerId || p.Id === event.playerId);
                
                return (
                    <div key={idx} className="bg-gray-700 px-3 py-2 rounded-md flex items-center justify-between text-sm border border-gray-600 shadow-sm">
                        <div className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="font-bold text-white">{player?.name || player?.Name || 'لاعب'}</span>
                        </div>
                        <span className="text-yellow-400 font-black bg-gray-800 px-2 py-0.5 rounded text-xs">{event.minute}'</span>
                    </div>
                );
            })
        )}
    </div>
</div>

        </div>
        {/* ========================================================= */}


        <h4 className="text-center font-bold text-gray-500 bg-gray-100 py-2 rounded-lg mb-4">سجل الأهداف والكروت 👇</h4>
        <div className="flex flex-col md:flex-row gap-4 w-full">
            
            {/* ==================== الفريق الأول ==================== */}
            <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                {t1Players.map(player => {
                    const playerId = player.id || player.Id;
                    const playerName = player.name || player.Name;
                    
                    const playerEvents = match.matchEvents?.filter(e => e.playerId === playerId) || [];
                    const goalsThisMatch = playerEvents.filter(e => e.eventType === 'player-goal').length;
                    const yellowsThisMatch = playerEvents.filter(e => e.eventType === 'yellow-card').length;
                    const redsThisMatch = playerEvents.filter(e => e.eventType === 'red-card').length;

                    return (
                        <div key={playerId} className={`flex flex-col xl:flex-row items-center justify-between p-2 rounded-lg shadow-sm border gap-3 ${redsThisMatch > 0 ? 'bg-red-50 border-red-300' : 'bg-white'}`}>
                            
                            {/* اسم اللاعب والأهداف/الكروت */}
                            <span className="font-bold text-sm text-gray-800 flex-1 flex items-center flex-wrap gap-1.5 w-full">
                                <span>{playerName}</span>
                                {goalsThisMatch > 0 && <span className="text-green-700 font-black text-xs bg-green-100 px-1.5 py-0.5 rounded border border-green-300">{goalsThisMatch} ⚽</span>}
                                {yellowsThisMatch > 0 && <span className="text-yellow-700 font-black text-xs bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-300">{yellowsThisMatch} 🟨</span>}
                                
                                {/* 🔥 الكارت الأحمر وعداد الدقيقتين 🔥 */}
                                {redsThisMatch > 0 && (
                                    <span className="flex items-center gap-1 text-red-700 font-black text-xs bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
                                        طرد 🟥
                                        {redCardTimers[`${match.id || match.Id}-${playerId}`] > 0 && (
                                            <span className="bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse font-mono">
                                                {formatTime(redCardTimers[`${match.id || match.Id}-${playerId}`])}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </span>

                            {/* 🎛️ زراير تحكم الإدمن */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'player-goal')} className="bg-green-100 hover:bg-green-200 text-green-800 border border-green-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">⚽ جول</button>
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'remove-goal')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">❌ إلغاء</button>
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'yellow-card')} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">🟨 إنذار</button>
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'red-card')} className="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">🟥 طرد</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ==================== الفريق الثاني ==================== */}
            <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                {t2Players.map(player => {
                    const playerId = player.id || player.Id;
                    const playerName = player.name || player.Name;
                    
                    const playerEvents = match.matchEvents?.filter(e => e.playerId === playerId) || [];
                    const goalsThisMatch = playerEvents.filter(e => e.eventType === 'player-goal').length;
                    const yellowsThisMatch = playerEvents.filter(e => e.eventType === 'yellow-card').length;
                    const redsThisMatch = playerEvents.filter(e => e.eventType === 'red-card').length;

                    return (
                        <div key={playerId} className={`flex flex-col xl:flex-row items-center justify-between p-2 rounded-lg shadow-sm border gap-3 ${redsThisMatch > 0 ? 'bg-red-50 border-red-300' : 'bg-white'}`}>
                            
                            {/* اسم اللاعب والأهداف/الكروت */}
                            <span className="font-bold text-sm text-gray-800 flex-1 flex items-center flex-wrap gap-1.5 w-full">
                                <span>{playerName}</span>
                                {goalsThisMatch > 0 && <span className="text-green-700 font-black text-xs bg-green-100 px-1.5 py-0.5 rounded border border-green-300">{goalsThisMatch} ⚽</span>}
                                {yellowsThisMatch > 0 && <span className="text-yellow-700 font-black text-xs bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-300">{yellowsThisMatch} 🟨</span>}
                                
                                {/* 🔥 الكارت الأحمر وعداد الدقيقتين 🔥 */}
                                {redsThisMatch > 0 && (
                                    <span className="flex items-center gap-1 text-red-700 font-black text-xs bg-red-100 px-1.5 py-0.5 rounded border border-red-300">
                                        طرد 🟥
                                        {redCardTimers[`${match.id || match.Id}-${playerId}`] > 0 && (
                                            <span className="bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse font-mono">
                                                {formatTime(redCardTimers[`${match.id || match.Id}-${playerId}`])}
                                            </span>
                                        )}
                                    </span>
                                )}
                            </span>

                            {/* 🎛️ زراير تحكم الإدمن */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'player-goal')} className="bg-green-100 hover:bg-green-200 text-green-800 border border-green-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">⚽ جول</button>
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'remove-goal')} className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">❌ إلغاء</button>
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'yellow-card')} className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">🟨 إنذار</button>
                                <button onClick={() => actionPlayer(match.id || match.Id, playerId, 'red-card')} className="bg-red-100 hover:bg-red-200 text-red-800 border border-red-300 px-2 py-1 rounded shadow-sm text-xs font-bold transition flex items-center gap-1">🟥 طرد</button>
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>

        {/* صافرة النهاية */}
        <button onClick={() => {
            toggleMatchTimer(match.id || match.Id, false); // وقف العداد لما الماتش يخلص
            handleFinishMatch(match.id || match.Id);
        }} className="w-64 mx-auto block bg-red-600 text-white px-8 py-3 rounded-xl font-black hover:bg-red-700 transition shadow-lg mt-6">
            صافرة النهاية 🛑
        </button>
    </div>
)}
                                                </div>
                                            );
                                        }
                                    })}
                                </div>
                                <div className="text-center mt-6 text-gray-400 font-bold text-xs opacity-80">
                                    مع تحيات إدارة البطولة ⚽
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
                
                {/* 👇 ضفنا pointer-events-none هنا عشان التوهج ميبلعش الكليك 👇 */}
                <div className="absolute -inset-10 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-full blur-xl animate-pulse pointer-events-none"></div>
                
                {/* ضفنا pointer-events-none للإيموجيز كمان كزيادة تأكيد */}
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
                
                <p className="text-lg font-bold text-yellow-300 mb-6 relative z-10">ألف مبروك للاعبين وللجماهير هذا الإنجاز التاريخي! 🎆</p>
                
                {/* 👇 ضفنا relative z-10 للزرار عشان نطلعه فوق كل الطبقات 👇 */}
                <button 
                    onClick={() => {setChampion(null); setActiveTab('standings')}}  
                    className="relative z-10 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-black hover:to-gray-900 text-white font-black px-8 py-3 rounded-xl border border-gray-600 transition shadow-lg w-full cursor-pointer"
                >
                    إغلاق والعودة للوحة التحكم ✖️
                </button>
                
            </div>
        </div>
    </div>
)}
        </div>
    );
}