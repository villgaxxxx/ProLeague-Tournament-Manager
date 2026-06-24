import { useState, useEffect, useCallback } from 'react';
import { toPng } from 'html-to-image';

export default function Matches({ setActiveTab }) {
    const [matches, setMatches] = useState([]);
    const [champion, setChampion] = useState(null);
    const isAdmin = !!localStorage.getItem('adminToken');

    const fetchMatches = useCallback(() => {
        fetch('/api/Matches')
            .then(res => res.json())
            .then(data => setMatches(Array.isArray(data) ? data : data?.$values || []))
            .catch(err => console.error("Error fetching matches:", err));
    }, []);

    // 🔥 التعديل هنا: نظفنا الـ useEffect المتكررة ودمجنا البولينج بشكل سليم
    useEffect(() => {
        // 1. تشغيل الدالة فوراً أول ما الصفحة تفتح
        fetchMatches();

        // 2. تحديث صامت في الخلفية كل 3 ثواني (بديل الـ SignalR)
        const pollingInterval = setInterval(() => {
            fetchMatches();
        }, 3000);

        // 3. تنظيف العداد لما اليوزر يخرج من الصفحة
        return () => clearInterval(pollingInterval);
    }, [fetchMatches]);

    const handleStartMatch = async (id) => {
        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Matches/${id}/start`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        fetchMatches();
    };

    const handlePostponeMatch = async (id) => {
        const reason = window.prompt("ما هو سبب تأجيل المباراة؟ (مثال: سوء الأحوال الجوية، انسحاب...)");
        if (!reason) return;

        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Matches/${id}/postpone`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(reason)
        });
        fetchMatches();
    };

    const actionPlayer = async (matchId, playerId, action) => {
        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Matches/${matchId}/${action}/${playerId}`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
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
            roundKey = "الأدوار الإقصائية 🏆";
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
                                    <h3 className="text-2xl font-black bg-blue-950 text-white px-10 py-3 rounded-full shadow-lg border-4 border-blue-100">
                                        {roundKey}
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
            <div className="flex items-center gap-2 sm:gap-3 bg-red-600 text-white px-3 py-1 sm:px-5 sm:py-2 rounded-xl font-mono text-xl sm:text-3xl font-black shadow-md animate-pulse">
                <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
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
                                                                <button onClick={() => handlePostponeMatch(match.id || match.Id)} className="bg-yellow-500 text-yellow-900 px-6 py-2 rounded-lg font-bold hover:bg-yellow-600 transition shadow">
                                                                    ⏸️ تأجيل
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isAdmin && match.isPlaying && (
                                                        <div className="mt-6 w-full border-t border-gray-100 pt-6 hide-in-screenshot">
                                                            <h4 className="text-center font-bold text-gray-500 bg-gray-100 py-2 rounded-lg mb-4">سجل الأهداف والكروت 👇</h4>
                                                            <div className="flex flex-col md:flex-row gap-4 w-full">
                                                                
                                                                {/* ==================== الفريق الأول ==================== */}
<div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
    {t1Players.map(player => {
        // 🔥 حساب أهداف اللاعب في هذا الماتش فقط من خلال قائمة الهدافين
        const matchScorersString = match.team1Scorers || match.Team1Scorers || "";
        const playerName = player.name || player.Name;
        // بنشوف اسمه اتكرر كام مرة في قائمة الهدافين بتاعة الماتش ده
        const goalsThisMatch = matchScorersString.split(',').filter(name => name === playerName).length;

        return (
            <div key={player.id || player.Id} className={`flex items-center justify-between p-2 rounded-lg shadow-sm border ${player.isSuspended ? 'bg-red-50 opacity-75' : 'bg-white'}`}>
                <span className="font-bold text-sm text-gray-800 flex-1 flex items-center flex-wrap gap-1">
                    <span>{playerName}</span>
                    
                    {/* كروت الماتش الحالي */}
                    {(player.yellowCardsThisMatch > 0 || player.YellowCardsThisMatch > 0) && (
                        <span className="text-yellow-600 font-black text-[10px] sm:text-xs mx-0.5 bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-300 shadow-sm">
                            {player.yellowCardsThisMatch || player.YellowCardsThisMatch} 🟨
                        </span>
                    )}
                    
                    {/* الطرد في الماتش الحالي */}
                    {(player.suspendedThisMatch === true || player.SuspendedThisMatch === true) && (
                        <span className="text-red-600 font-black text-[10px] sm:text-xs mx-0.5 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 shadow-sm">
                            🟥 طرد في المباراة
                        </span>
                    )}
                    
                    {/* 🔥 التعديل هنا: أهداف اللاعب في الماتش الحالي فقط 🔥 */}
                    {goalsThisMatch > 0 && (
                        <span className="text-green-700 font-black text-[10px] sm:text-xs mx-0.5 bg-green-100 px-1.5 py-0.5 rounded border border-green-300 shadow-sm">
                            {goalsThisMatch} ⚽
                        </span>
                    )}
                </span>
                
                {/* زراير الإجراءات */}
                {!player.isSuspended && (
                    <div className="flex gap-1 shrink-0">
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'yellow-card')} className="bg-yellow-400 px-2 py-1 rounded text-xs hover:bg-yellow-500 transition shadow-sm">🟨</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'red-card')} className="bg-red-600 px-2 py-1 rounded text-xs hover:bg-red-700 transition shadow-sm">🟥</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'blue-card')} className="bg-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-700 transition shadow-sm" title="طرد أخلاقي">🟦</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'player-goal')} className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-green-700 transition shadow-sm">⚽</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'remove-goal')} className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-700 transition shadow-sm">-⚽</button>
                    </div>
                )}
            </div>
        );
    })}
</div>



{/* ==================== الفريق الثاني ==================== */}
<div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
    {t2Players.map(player => {
        // 🔥 حساب أهداف اللاعب في هذا الماتش فقط من خلال قائمة الهدافين
        const matchScorersString = match.team2Scorers || match.Team2Scorers || "";
        const playerName = player.name || player.Name;
        // بنشوف اسمه اتكرر كام مرة في قائمة الهدافين بتاعة الماتش ده
        const goalsThisMatch = matchScorersString.split(',').filter(name => name === playerName).length;

        return (
            <div key={player.id || player.Id} className={`flex items-center justify-between p-2 rounded-lg shadow-sm border ${player.isSuspended ? 'bg-red-50 opacity-75' : 'bg-white'}`}>
                <span className="font-bold text-sm text-gray-800 flex-1 flex items-center flex-wrap gap-1">
                    <span>{playerName}</span>
                    
                    {/* كروت الماتش الحالي */}
                    {(player.yellowCardsThisMatch > 0 || player.YellowCardsThisMatch > 0) && (
                        <span className="text-yellow-600 font-black text-[10px] sm:text-xs mx-0.5 bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-300 shadow-sm">
                            {player.yellowCardsThisMatch || player.YellowCardsThisMatch} 🟨
                        </span>
                    )}
                    
                    {/* الطرد في الماتش الحالي */}
                    {(player.suspendedThisMatch === true || player.SuspendedThisMatch === true) && (
                        <span className="text-red-600 font-black text-[10px] sm:text-xs mx-0.5 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 shadow-sm">
                            🟥 طرد في المباراة
                        </span>
                    )}
                    
                    {/* 🔥 التعديل هنا: أهداف اللاعب في الماتش الحالي فقط 🔥 */}
                    {goalsThisMatch > 0 && (
                        <span className="text-green-700 font-black text-[10px] sm:text-xs mx-0.5 bg-green-100 px-1.5 py-0.5 rounded border border-green-300 shadow-sm">
                            {goalsThisMatch} ⚽
                        </span>
                    )}
                </span>
                
                {/* زراير الإجراءات */}
                {!player.isSuspended && (
                    <div className="flex gap-1 shrink-0">
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'yellow-card')} className="bg-yellow-400 px-2 py-1 rounded text-xs hover:bg-yellow-500 transition shadow-sm">🟨</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'red-card')} className="bg-red-600 px-2 py-1 rounded text-xs hover:bg-red-700 transition shadow-sm">🟥</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'blue-card')} className="bg-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-700 transition shadow-sm" title="طرد أخلاقي">🟦</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'player-goal')} className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-green-700 transition shadow-sm">⚽</button>
                        <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'remove-goal')} className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-red-700 transition shadow-sm">-⚽</button>
                    </div>
                )}
            </div>
        );
    })}
</div>

                                                                

                                                            </div>
                                                            <button onClick={() => handleFinishMatch(match.id || match.Id)} className="w-64 mx-auto block bg-red-600 text-white px-8 py-3 rounded-xl font-black hover:bg-red-700 transition shadow-lg mt-6">
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