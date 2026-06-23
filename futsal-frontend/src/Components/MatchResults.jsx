import { useState, useEffect } from 'react';
import { toPng } from 'html-to-image';

export default function MatchResults() {
    const [matchesByRound, setMatchesByRound] = useState({});
    const [loading, setLoading] = useState(true);
    const isAdmin = !!localStorage.getItem('adminToken'); // عشان نظهر زرار التصوير للأدمن بس

    useEffect(() => {
        fetch('/api/Matches')
            .then(response => response.json())
            .then(data => {
                const matchesData = Array.isArray(data) ? data : data?.$values || [];
                
                // 1. فلترة المباريات المنتهية فقط
                const finishedMatches = matchesData.filter(m => m.isFinished === true || m.IsFinished === true);
                
                // 2. تقسيم المباريات المنتهية إلى جولات
                const grouped = finishedMatches.reduce((acc, match) => {
                    const type = match.matchType || match.MatchType;
                    let roundKey = "";
            
                    if (type !== "Group" && type !== undefined) {
                        roundKey = "الأدوار الإقصائية 🏆";
                    } else {
                        const round = match.roundNumber ?? match.RoundNumber ?? 1;
                        roundKey = `نتائج الجولة ${round}`;
                    }
            
                    if (!acc[roundKey]) acc[roundKey] = [];
                    acc[roundKey].push(match);
                    return acc;
                }, {});

                setMatchesByRound(grouped);
                setLoading(false);
            })
            .catch(error => {
                console.error("خطأ في جلب النتائج:", error);
                setLoading(false);
            });
    }, []);

    // 📸 دالة التقاط النتيجة كصورة
    const handleDownloadResultsImage = async (roundKey) => {
        const elementId = `result-capture-${roundKey.replace(/\s+/g, '-')}`;
        const element = document.getElementById(elementId);
        
        if (!element) return;

        try {
            const originalBg = element.style.backgroundColor;
            const originalPadding = element.style.padding;
            const originalRadius = element.style.borderRadius;
            const originalWidth = element.style.width;
            const originalMaxWidth = element.style.maxWidth;

            element.style.width = '800px'; 
            element.style.maxWidth = 'none';
            element.style.backgroundColor = '#f8fafc';
            element.style.padding = '30px';
            element.style.borderRadius = '16px';

            const dataUrl = await toPng(element, {
                quality: 1.0,
                pixelRatio: 2,
                width: 800,
                style: { transform: 'scale(1)', transformOrigin: 'top left' },
                filter: (node) => {
                    if (node?.classList?.contains('hide-in-screenshot')) return false;
                    return true;
                }
            });

            element.style.width = originalWidth;
            element.style.maxWidth = originalMaxWidth;
            element.style.backgroundColor = originalBg;
            element.style.padding = originalPadding;
            element.style.borderRadius = originalRadius;

            const link = document.createElement('a');
            link.download = `${roundKey}-أرشيف.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("حدث خطأ أثناء التقاط الصورة:", error);
            alert("حدث خطأ أثناء تجهيز الصورة، يرجى المحاولة مرة أخرى.");
        }
    };

    if (loading) {
        return <div className="text-center py-10 font-bold text-gray-600">جاري تحميل الأرشيف والتحليلات... 🕒</div>;
    }


    // ⚽ دالة تجميع وعرض الهدافين ⚽
    const renderScorers = (scorersString) => {
        if (!scorersString) return null;
        
        const scorersArray = scorersString.split(',').filter(Boolean);
        if (scorersArray.length === 0) return null;

        const grouped = scorersArray.reduce((acc, name) => {
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});

        return (
            <div className="flex flex-col gap-1 items-center mt-1.5 text-[10px] sm:text-xs text-green-700 font-bold">
                {Object.entries(grouped).map(([name, count], idx) => (
                    <span key={idx} className="bg-green-50 px-1.5 py-0.5 rounded border border-green-200 shadow-sm flex items-center justify-center">
                        {name} <span className="ml-0.5 text-[8px] sm:text-[10px]">{"⚽".repeat(count)}</span>
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto mt-8 px-4 mb-16" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-10 text-green-700 flex items-center justify-center gap-3">
                <span>🏆</span> أرشيف نتائج المباريات
            </h2>

            {Object.keys(matchesByRound).length === 0 ? (
                <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-gray-500 font-bold">
                    لا توجد مباريات منتهية حتى الآن.
                </div>
            ) : (
                Object.keys(matchesByRound).map(roundKey => {
                    const safeId = `result-capture-${roundKey.replace(/\s+/g, '-')}`;

                    return (
                        <div key={roundKey} className="mb-14 relative">
                            
                            {/* 🔥 زرار التصوير للأدمن */}
                            {isAdmin && (
                                <div className="flex justify-end mb-4 px-2">
                                    <button 
                                        onClick={() => handleDownloadResultsImage(roundKey)}
                                        className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-2 rounded-xl font-bold hover:shadow-lg transition transform hover:-translate-y-1 text-sm border-2 border-green-200"
                                    >
                                        <span>📸</span> تحميل {roundKey}
                                    </button>
                                </div>
                            )}

                            <div id={safeId} className="p-4 rounded-3xl bg-gray-50/50">
                                
                                {/* عنوان الجولة */}
                                <div className="flex items-center justify-center mb-8">
                                    <h3 className="text-2xl font-black bg-green-900 text-white px-10 py-3 rounded-full shadow-lg border-4 border-green-100">
                                        {roundKey}
                                    </h3>
                                </div>

                                <div className="grid gap-6">
                                    {matchesByRound[roundKey].map(match => {
                                        const pen1 = match.team1PenaltiesScore ?? match.Team1PenaltiesScore;
                                        const pen2 = match.team2PenaltiesScore ?? match.Team2PenaltiesScore;

                                        return (
                                            <div key={match.id || match.Id} className="bg-white p-4 sm:p-6 rounded-xl shadow-md border-r-8 border-green-600 flex flex-col transition-all relative overflow-hidden">
                                                
                                                {/* اسم المجموعة والتاريخ */}
                                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                                    {(match.groupName || match.GroupName) && (
                                                        <span className="bg-gray-200 text-gray-700 px-3 py-1 text-xs font-bold rounded-md">
                                                            المجموعة {match.groupName || match.GroupName}
                                                        </span>
                                                    )}
                                                    <span className="text-xs text-gray-500 font-bold">
                                                        {match.matchDate && new Date(match.matchDate).getFullYear() > 2001 
                                                            ? new Date(match.matchDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })
                                                            : 'تاريخ غير محدد'}
                                                    </span>
                                                </div>

                                                {/* النتيجة والفرق */}
                                                {/* 1. السطر ده بيعرض الفرق والنتيجة (اللي إنت باعته) */}
<div className="flex justify-between items-center w-full px-1 sm:px-4 mt-6">
    <span className="flex-1 text-center font-black text-gray-700 leading-tight px-1 break-words text-xs xs:text-sm sm:text-base md:text-xl lg:text-2xl">
        {match.team1?.name || match.Team1?.Name}
    </span>
    
    <div className="flex flex-col items-center shrink-0 mx-1 xs:mx-2">
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 bg-green-50 text-green-900 border border-green-200 font-black shadow-sm font-mono rounded-lg xs:rounded-xl px-2 xs:px-3 sm:px-5 py-1 xs:py-1.5 sm:py-2 text-lg xs:text-xl sm:text-2xl md:text-3xl">
            <span>{match.team1Score ?? 0}</span>:<span>{match.team2Score ?? 0}</span>
        </div>
        {pen1 !== null && pen1 !== undefined && (
            <span className="font-bold text-orange-600 mt-1 text-[9px] xs:text-[10px] sm:text-xs">ترجيح: ({pen1}) - ({pen2})</span>
        )}
    </div>
    
    <span className="flex-1 text-center font-black text-gray-700 leading-tight px-1 break-words text-xs xs:text-sm sm:text-base md:text-xl lg:text-2xl">
        {match.team2?.name || match.Team2?.Name}
    </span>
</div>

{/* ========================================================= */}
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

                                                {/* 🤖 التعليق الذكي (سيظهر في الصورة لأننا لم نضع كلاس الإخفاء) */}
                                                {(match.matchSummary || match.MatchSummary) && (
                                                    <div className="mt-5 bg-indigo-50 border-r-4 border-indigo-500 p-4 rounded-lg shadow-sm relative overflow-hidden">
                                                        <div className="absolute -left-4 -top-4 text-indigo-100 opacity-50 text-6xl transform -rotate-12">🎙️</div>
                                                        <div className="flex items-center gap-2 mb-2 relative z-10">
                                                            <span className="text-xl">🤖</span>
                                                            <span className="text-sm font-black text-indigo-800 tracking-wide uppercase">تعليق الماتش (AI):</span>
                                                        </div>
                                                        <p className="text-xs sm:text-sm md:text-base font-bold text-gray-700 leading-relaxed italic relative z-10 break-words">
                                                            "{match.matchSummary || match.MatchSummary}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="text-center mt-6 text-gray-400 font-bold text-xs opacity-80">
                                    أرشيف المباريات - تم الإنشاء بواسطة نظام إدارة البطولات ⚽
                                </div>
                            </div>

                        </div>
                    );
                })
            )}
        </div>
    );
}