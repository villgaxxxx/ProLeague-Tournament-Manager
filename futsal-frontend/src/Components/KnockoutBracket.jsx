import { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';

export default function KnockoutBracket() {
    const [knockoutMatches, setKnockoutMatches] = useState([]);
    const [teamMap, setTeamMap] = useState({}); // 👈 خريطة لفك شفرات أسماء الفرق
    const [loading, setLoading] = useState(true);
    const bracketRef = useRef(null);

    useEffect(() => {
        // 1. جلب أسماء الفرق أولاً لبناء خريطة أمان بالـ IDs
        fetch('https://proleague-api.somee.com/api/teams')
            .then(res => res.json())
            .then(teamsData => {
                const list = Array.isArray(teamsData) ? teamsData : (teamsData?.$values || []);
                const map = {};
                list.forEach(t => {
                    map[t.id || t.Id] = t.name || t.Name;
                });
                setTeamMap(map);

                // 2. بعد بناء الخريطة، نجلب المباريات الإقصائية المنشورة
                return fetch('https://proleague-api.somee.com/api/Matches');
            })
            .then(res => res.json())
            .then(data => {
                const matchesData = Array.isArray(data) ? data : (data?.$values || []);
                const knockouts = matchesData.filter(m => m.matchType !== "Group" && (m.isPublished === true || m.IsPublished === true));
                setKnockoutMatches(knockouts);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error in bracket initialization:", err);
                setLoading(false);
            });
    }, []);

    const handleExportImage = async () => {
        if (!bracketRef.current) return;
        try {
            const dataUrl = await toPng(bracketRef.current, { 
                quality: 1, 
                pixelRatio: 2, 
                backgroundColor: "#ffffff" 
            });
            const link = document.createElement("a");
            link.download = "شجرة_البطولة_الرسمية.png";
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("Error exporting image:", error);
        }
    };

    if (loading) return <div className="text-center mt-10 font-bold text-xl text-gray-700">جاري تحميل شجرة البطولة... ⏳</div>;

    if (knockoutMatches.length === 0) {
        return (
            <div className="max-w-4xl mx-auto mt-8 px-4" dir="rtl">
                <h2 className="text-3xl font-black text-center mb-6 text-gray-800">الأدوار الإقصائية 🏆</h2>
                <div className="bg-white p-8 rounded-xl shadow-md text-center border-t-4 border-red-500">
                    <p className="font-bold text-gray-500 text-lg">لم تبدأ الأدوار الإقصائية بعد أو في انتظار قيام الإدمن بنشر المباريات من غرفة الجدولة! ⏳</p>
                </div>
            </div>
        );
    }

    const groupedRounds = knockoutMatches.reduce((acc, match) => {
        const round = match.matchType || match.MatchType;
        if (!acc[round]) acc[round] = [];
        acc[round].push(match);
        return acc;
    }, {});

    const quarters = groupedRounds["QuarterFinal"] || [];
    const semis = groupedRounds["SemiFinal"] || [];
    const final = groupedRounds["Final"] || [];
    const hasQuarters = quarters.length > 0 || semis.length > 0 || final.length > 0;

    // -----------------------------------------------------
    // المكون الداخلي للمباراة بعد تزويده بخريطة فك التشفير
    // -----------------------------------------------------
    const MatchNode = ({ match, isFinal }) => {
        if (!match) {
            return (
                <div className="h-16 w-48 bg-gray-50 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center text-gray-400 text-xs font-bold shadow-sm">
                    في الانتظار...
                </div>
            );
        }

        const isFinished = match.isFinished === true || match.IsFinished === true;
        const isPlaying = match.isPlaying === true || match.IsPlaying === true;
        const score1 = match.team1Score ?? match.Team1Score ?? null;
        const score2 = match.team2Score ?? match.Team2Score ?? null;
        const pen1 = match.team1PenaltiesScore ?? match.Team1PenaltiesScore;
        const pen2 = match.team2PenaltiesScore ?? match.Team2PenaltiesScore;

        // جلب الأسماء بشكل مضمون 100% من الخريطة عن طريق الـ ID لمنع كمين الـ $ref
        const t1Id = match.team1Id || match.Team1Id;
        const t2Id = match.team2Id || match.Team2Id;
        const team1Name = teamMap[t1Id] || match.team1?.name || match.Team1?.Name || "فريق 1";
        const team2Name = teamMap[t2Id] || match.team2?.name || match.Team2?.Name || "فريق 2";

        let t1Won = false, t2Won = false;
        if (isFinished) {
            if (score1 > score2) t1Won = true;
            else if (score2 > score1) t2Won = true;
            else if (pen1 > pen2) t1Won = true;
            else if (pen2 > pen1) t2Won = true;
        }

        return (
            <div className={`relative w-48 flex flex-col bg-white border rounded-md shadow-md overflow-hidden ${isFinal ? 'border-yellow-400 ring-2 ring-yellow-200 scale-110 z-10' : 'border-gray-300'} ${isPlaying ? 'animate-pulse border-red-500 ring-1 ring-red-300' : ''}`}>
                {/* الفريق 1 */}
                <div className={`flex justify-between items-center px-2 py-1.5 border-b ${t1Won ? 'bg-green-50' : ''} ${isFinished && !t1Won ? 'text-gray-400 bg-gray-50' : 'text-gray-900'}`}>
                    <div className="flex items-center gap-2 overflow-hidden w-2/3">
                        <div className={`w-1.5 h-4 rounded-sm ${t1Won ? 'bg-green-600' : (isFinished ? 'bg-gray-300' : 'bg-indigo-600')}`}></div>
                        <span className="font-bold text-xs truncate" dir="rtl">{team1Name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono">
                        {pen1 !== null && pen1 !== undefined && <span className="text-[10px] text-orange-600 font-bold">({pen1})</span>}
                        {score1 !== null && <span className="font-bold text-sm bg-gray-100 px-1.5 rounded">{score1}</span>}
                    </div>
                </div>

                {/* الفريق 2 */}
                <div className={`flex justify-between items-center px-2 py-1.5 ${t2Won ? 'bg-green-50' : ''} ${isFinished && !t2Won ? 'text-gray-400 bg-gray-50' : 'text-gray-900'}`}>
                    <div className="flex items-center gap-2 overflow-hidden w-2/3">
                        <div className={`w-1.5 h-4 rounded-sm ${t2Won ? 'bg-green-600' : (isFinished ? 'bg-gray-300' : 'bg-red-600')}`}></div>
                        <span className="font-bold text-xs truncate" dir="rtl">{team2Name}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono">
                        {pen2 !== null && pen2 !== undefined && <span className="text-[10px] text-orange-600 font-bold">({pen2})</span>}
                        {score2 !== null && <span className="font-bold text-sm bg-gray-100 px-1.5 rounded">{score2}</span>}
                    </div>
                </div>
                {isPlaying && <div className="absolute top-0 left-0 bg-red-600 text-white text-[9px] px-1 rounded-br-md font-bold">مباشر</div>}
            </div>
        );
    };

    return (
        <div className="max-w-full mx-auto mt-8 px-4 mb-16" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 max-w-6xl mx-auto">
                <h2 className="text-3xl font-black text-gray-800">برنامج الأدوار الإقصائية 🏆</h2>
                <button onClick={handleExportImage} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg shadow flex items-center gap-2 transition">
                    📸 تصدير الصورة
                </button>
            </div>

            <div className="overflow-x-auto pb-8 w-full">
                <div ref={bracketRef} className="bg-slate-50 p-10 min-w-[1100px] flex justify-center items-center border border-gray-100 rounded-3xl" dir="ltr">
                    <div className="flex justify-center items-stretch w-full relative gap-0">
                        
                        {/* ربع النهائي يسار */}
                        {hasQuarters && (
                            <div className="flex flex-col justify-around gap-12 z-10 py-6">
                                <MatchNode match={quarters[0]} />
                                <MatchNode match={quarters[1]} />
                            </div>
                        )}

                        {/* خطوط ربع النهائي يسار */}
                        {hasQuarters && (
                            <div className="w-8 flex flex-col justify-around py-10 opacity-60">
                                <div className="flex-1 border-r-2 border-t-2 border-gray-400 rounded-tr-xl mb-[-1px]"></div>
                                <div className="flex-1 border-r-2 border-b-2 border-gray-400 rounded-br-xl mt-[-1px]"></div>
                            </div>
                        )}

                        {/* نصف النهائي يسار */}
                        <div className="flex flex-col justify-center z-10">
                            <MatchNode match={semis[0]} />
                        </div>

                        {/* خط نصف النهائي يسار */}
                        <div className="w-12 flex flex-col justify-center opacity-60">
                            <div className="w-full border-b-2 border-gray-400"></div>
                        </div>

                        {/* النهائي 🏆 */}
                        <div className="flex flex-col justify-center items-center px-4 z-20">
                            <div className="flex flex-col items-center mb-4">
                                <span className="text-5xl drop-shadow-md">🏆</span>
                                <span className="font-black text-yellow-600 tracking-wider mt-2">النهائي</span>
                            </div>
                            <MatchNode match={final[0]} isFinal />
                        </div>

                        {/* خط نصف النهائي يمين */}
                        <div className="w-12 flex flex-col justify-center opacity-60">
                            <div className="w-full border-b-2 border-gray-400"></div>
                        </div>

                        {/* نصف النهائي يمين */}
                        <div className="flex flex-col justify-center z-10">
                            <MatchNode match={semis[1]} />
                        </div>

                        {/* خطوط ربع النهائي يمين */}
                        {hasQuarters && (
                            <div className="w-8 flex flex-col justify-around py-10 opacity-60">
                                <div className="flex-1 border-l-2 border-t-2 border-gray-400 rounded-tl-xl mb-[-1px]"></div>
                                <div className="flex-1 border-l-2 border-b-2 border-gray-400 rounded-bl-xl mt-[-1px]"></div>
                            </div>
                        )}

                        {/* ربع النهائي يمين */}
                        {hasQuarters && (
                            <div className="flex flex-col justify-around gap-12 z-10 py-6">
                                <MatchNode match={quarters[2]} />
                                <MatchNode match={quarters[3]} />
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>
        </div>
    );
}