import { useState, useEffect } from 'react';

export default function MatchResults() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // نعدل الرابط عشان يجيب كل الماتشات من السيرفر الأساسي
        fetch('/api/Matches')
            .then(response => response.json())
            .then(data => {
                // نفلتر الماتشات عشان نعرض اللي اتعملها "إنهاء" بس
                const finishedMatches = data.filter(m => m.isFinished);
                setResults(finishedMatches);
                setLoading(false);
            })
            .catch(error => {
                console.error("خطأ في جلب النتائج:", error);
                setLoading(false);
            });
    }, []);

    if (loading) {
        return <div className="text-center py-10 font-bold">جاري تحميل الأرشيف... 🕒</div>;
    }

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto mt-10" dir="rtl">
            <h2 className="text-2xl font-black border-b pb-3 mb-5 text-green-700">🏆 نتائج المباريات السابقة</h2>

            {results.length === 0 ? (
                <div className="text-center p-5 text-gray-500 font-bold">لا توجد مباريات منتهية بعد.</div>
            ) : (
                <div className="space-y-4">
                    {results.map((match) => (
                        <div key={match.id} className="flex flex-col md:flex-row justify-between items-center border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm transition hover:bg-white hover:shadow-md">
                            
                            {/* تاريخ المباراة */}
                            <div className="text-sm text-gray-500 font-bold mb-2 md:mb-0">
                                {new Date(match.matchDate).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>

                            {/* لوحة عرض النتيجة الرقمية */}
                            <div className="flex items-center justify-center gap-6 w-full md:w-2/3">
                                {/* الفريق الأول */}
                                {/* الفريق الأول */}
                                <div className="w-2/5 text-left font-black text-lg text-blue-900">
                                    {match.team1?.name || match.Team1?.Name || "فريق 1"}
                                </div>
                                
                                {/* النتيجة المتناسقة */}
                                <div className="flex items-center gap-2 bg-blue-900 text-white px-4 py-2 rounded-lg font-mono text-xl font-black shadow-inner">
                                    <span>{match.team1Score || match.Team1Score || 0}</span>
                                    <span className="text-gray-400">:</span>
                                    <span>{match.team2Score || match.Team2Score || 0}</span>
                                </div>

                                {/* الفريق الثاني */}
                                <div className="w-2/5 text-right font-black text-lg text-blue-900">
                                    {match.team2?.name || match.Team2?.Name || "فريق 2"}
                                </div>
                            </div>

                            {/* شارة انتهاء المباراة */}
                            <div className="mt-2 md:mt-0 bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full border border-green-200 shadow-sm">
                                انتهت
                            </div>

                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}