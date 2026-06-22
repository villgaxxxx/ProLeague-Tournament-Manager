import { useState, useEffect, useCallback } from 'react';
import * as signalR from "@microsoft/signalr";
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

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    useEffect(() => {
        const backendUrl = "/matchHub"; 
        
        const connection = new signalR.HubConnectionBuilder()
            .withUrl(backendUrl)
            .withAutomaticReconnect()
            .build();

        connection.start()
            .then(() => console.log("متصل بنجاح بالسيرفر لايف! ⚡"))
            .catch(err => console.error("SignalR Connection Error: ", err));

        connection.on("ReceiveMatchUpdate", () => {
            console.log("إشارة تحديث وصلت من السيرفر! 📡");
            fetchMatches(); 
        });

        return () => {
            connection.stop();
        };
    }, []); 

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

    // 🔥 تجميع المباريات حسب رقم الجولة
    const matchesByRound = matches.reduce((acc, match) => {
        const type = match.matchType || match.MatchType;
        let roundKey = "";

        // لو أدوار إقصائية (خروج مغلوب) نحطها في قسم لوحدها
        if (type !== "Group" && type !== undefined) {
            roundKey = "الأدوار الإقصائية 🏆";
        } else {
            // لو مجموعات، نقسمها بالجولات
            const round = match.roundNumber || match.RoundNumber || 1;
            roundKey = `الجولة ${round}`;
        }

        if (!acc[roundKey]) acc[roundKey] = [];
        acc[roundKey].push(match);
        return acc;
    }, {});

    // 📸 دالة التقاط جدول الجولة كصورة (بالمكتبة الحديثة)
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
                pixelRatio: 2, // جودة عالية
                filter: (node) => {
                    // 🔥 السر هنا: تجاهل أي زرار أو عنصر واخد كلاس hide-in-screenshot
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
                            
                            {/* 🔥 التعديل: زرار التحميل يظهر للأدمن فقط 🔥 */}
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

                                                    <div className="flex justify-between items-center w-full px-4 mt-2">
                                                        <span className="text-xl font-black w-1/3 text-center text-gray-700">{match.team1?.name || match.Team1?.Name}</span>
                                                        <div className="flex flex-col items-center">
                                                            <div className="flex items-center gap-3 bg-gray-100 text-gray-800 px-5 py-2 rounded-xl font-mono text-2xl font-black shadow-inner">
                                                                <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
                                                            </div>
                                                            {pen1 !== null && pen1 !== undefined && (
                                                                <span className="text-xs font-bold text-orange-600 mt-1">ترجيح: ({pen1}) - ({pen2})</span>
                                                            )}
                                                        </div>
                                                        <span className="text-xl font-black w-1/3 text-center text-gray-700">{match.team2?.name || match.Team2?.Name}</span>
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

                                                    <div className="flex justify-between items-center w-full mt-4 px-4">
                                                        <span className={`text-2xl font-black w-1/3 text-center ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>
                                                            {match.team1?.name || match.Team1?.Name || "فريق 1"}
                                                        </span>
                                                        
                                                        {match.isPlaying ? (
                                                            <div className="flex items-center gap-3 bg-red-600 text-white px-5 py-2 rounded-xl font-mono text-3xl font-black shadow-md animate-pulse">
                                                                <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 font-black text-xl bg-gray-200 px-4 py-1 rounded-lg">VS</span>
                                                        )}

                                                        <span className={`text-2xl font-black w-1/3 text-center ${match.isPostponed ? 'text-gray-500' : 'text-blue-950'}`}>
                                                            {match.team2?.name || match.Team2?.Name || "فريق 2"}
                                                        </span>
                                                    </div>

                                                    {match.isPlaying && (
                                                        <div className="mt-4 text-red-600 font-black text-sm flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                                                            <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping"></span>مباشر
                                                        </div>
                                                    )}

                                                    {/* 🔥 التعديل: إضافة hide-in-screenshot عشان ميظهرش في الصورة */}
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

                                                    {/* 🔥 التعديل: إضافة hide-in-screenshot لزراير الأهداف والكروت وصافرة النهاية */}
                                                    {isAdmin && match.isPlaying && (
                                                        <div className="mt-6 w-full border-t border-gray-100 pt-6 hide-in-screenshot">
                                                            <h4 className="text-center font-bold text-gray-500 bg-gray-100 py-2 rounded-lg mb-4">سجل الأهداف والكروت 👇</h4>
                                                            <div className="flex flex-col md:flex-row gap-4 w-full">
                                                                
                                                                <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                                                    {t1Players.map(player => (
                                                                        <div key={player.id || player.Id} className={`flex items-center justify-between p-2 rounded-lg shadow-sm border ${player.isSuspended ? 'bg-red-50 opacity-75' : 'bg-white'}`}>
                                                                            <span className="font-bold text-sm text-gray-800 flex-1">
                                                                                {player.name || player.Name}
                                                                                {player.isSuspended && <span className="text-red-600 mr-2 text-xs">🚫 ({player.suspendedMatchesLeft} ماتش)</span>}
                                                                            </span>
                                                                            {!player.isSuspended && (
                                                                                <div className="flex gap-1">
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'yellow-card')} className="bg-yellow-400 px-2 py-1 rounded text-xs">🟨</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'red-card')} className="bg-red-600 px-2 py-1 rounded text-xs">🟥</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'blue-card')} className="bg-blue-600 px-2 py-1 rounded text-xs" title="طرد أخلاقي">🟦</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'player-goal')} className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">⚽</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'remove-goal')} className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">-⚽</button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                <div className="flex-1 bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-3">
                                                                    {t2Players.map(player => (
                                                                        <div key={player.id || player.Id} className={`flex items-center justify-between p-2 rounded-lg shadow-sm border ${player.isSuspended ? 'bg-red-50 opacity-75' : 'bg-white'}`}>
                                                                            <span className="font-bold text-sm text-gray-800 flex-1">
                                                                                {player.name || player.Name}
                                                                                {player.isSuspended && <span className="text-red-600 mr-2 text-xs">🚫 ({player.suspendedMatchesLeft} ماتش)</span>}
                                                                            </span>
                                                                            {!player.isSuspended && (
                                                                                <div className="flex gap-1">
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'yellow-card')} className="bg-yellow-400 px-2 py-1 rounded text-xs">🟨</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'red-card')} className="bg-red-600 px-2 py-1 rounded text-xs">🟥</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'blue-card')} className="bg-blue-600 px-2 py-1 rounded text-xs" title="طرد أخلاقي">🟦</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'player-goal')} className="bg-green-600 text-white px-2 py-1 rounded text-xs font-bold">⚽</button>
                                                                                    <button onClick={() => actionPlayer(match.id || match.Id, player.id || player.Id, 'remove-goal')} className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold">-⚽</button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    ))}
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
                                    تم الإنشاء بواسطة نظام إدارة البطولات الاحترافي ⚽
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
                            <div className="absolute -inset-10 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-full blur-xl animate-pulse"></div>
                            <span className="absolute top-6 left-6 text-4xl animate-ping">🎉</span>
                            <span className="absolute top-6 right-6 text-4xl animate-ping delay-300">🎊</span>
                            <span className="absolute bottom-10 left-10 text-3xl animate-bounce">✨</span>
                            <span className="absolute bottom-10 right-10 text-3xl animate-bounce delay-150">⚽</span>
                            <div className="text-7xl mb-6 bg-amber-500/10 p-6 rounded-full border border-yellow-400/30 animate-spin-slow">🏆</div>
                            <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-200 uppercase tracking-widest mb-2 animate-pulse">بطل البطولة رسمياً</h3>
                            <p className="text-sm text-gray-400 font-bold mb-6">اسدل الستار وانتهت الملحمة الكروية</p>
                            <div className="bg-yellow-500 text-slate-950 font-black text-4xl px-8 py-4 rounded-2xl shadow-xl tracking-wide mb-8 border-2 border-white/50 animate-pulse">
                                👑 {champion} 👑
                            </div>
                            <p className="text-lg font-bold text-yellow-300 mb-6">ألف مبروك للاعبين وللجماهير هذا الإنجاز التاريخي! 🎆</p>
                            <button onClick={() => {setChampion(null); setActiveTab('standings')}}  className="bg-gradient-to-r from-gray-800 to-gray-700 hover:from-black hover:to-gray-900 text-white font-black px-8 py-3 rounded-xl border border-gray-600 transition shadow-lg w-full">إغلاق والعودة للوحة التحكم ✖️</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}