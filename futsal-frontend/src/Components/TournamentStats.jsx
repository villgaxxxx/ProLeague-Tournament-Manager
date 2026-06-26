import { useState, useEffect } from 'react';

export default function TournamentStats() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch('/api/Tournament/statistics');
                const data = await res.json();
                setStats(data);
                setLoading(false);
            } catch (error) {
                console.error("مشكلة في جلب الإحصائيات:", error);
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) return <div className="text-center p-8 animate-pulse font-bold text-indigo-400">جاري تحميل الإحصائيات... ⏳</div>;
    
    // لو مفيش ماتشات اتلعبت لسه
    if (!stats || stats.TotalMatches === 0) return null;

    return (
        <div className="max-w-6xl mx-auto my-10 px-4" dir="rtl">
            <h2 className="text-3xl font-black text-gray-800 mb-6 flex items-center gap-2">
                📊 إحصائيات البطولة العامة
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* كارت الأهداف الإجمالية */}
                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transform transition hover:-translate-y-1">
                    <div className="relative z-10">
                        <p className="text-indigo-100 font-bold mb-1">إجمالي الأهداف</p>
                        <h3 className="text-4xl font-black">{stats.TotalGoals} <span className="text-lg font-normal">هدف</span></h3>
                        <p className="text-sm mt-3 bg-white/20 inline-block px-3 py-1 rounded-full">
                            بمعدل {stats.GoalsPerMatch} هدف/مباراة
                        </p>
                    </div>
                    <span className="absolute -bottom-4 -left-4 text-7xl opacity-20">⚽</span>
                </div>

                {/* كارت أفضل هجوم */}
                <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 relative overflow-hidden transform transition hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-gray-500 font-bold">أفضل هجوم</p>
                        <span className="text-2xl">🔥</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 truncate">{stats.BestAttack?.TeamName}</h3>
                    <p className="text-green-600 font-bold mt-2 text-lg">
                        {stats.BestAttack?.Value} أهداف مسجلة
                    </p>
                </div>

                {/* كارت أفضل دفاع */}
                <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 relative overflow-hidden transform transition hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-gray-500 font-bold">أقوى دفاع</p>
                        <span className="text-2xl">🛡️</span>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 truncate">{stats.BestDefense?.TeamName}</h3>
                    <p className="text-blue-600 font-bold mt-2 text-lg">
                        {stats.BestDefense?.Value} أهداف مستقبلة
                    </p>
                </div>

                {/* كارت الأكثر فوزاً */}
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden transform transition hover:-translate-y-1">
                    <div className="relative z-10">
                        <p className="text-yellow-50 font-bold mb-1">الأكثر تحقيقاً للفوز</p>
                        <h3 className="text-2xl font-black truncate">{stats.MostWins?.TeamName}</h3>
                        <p className="text-sm mt-3 bg-white/20 inline-block px-3 py-1 rounded-full font-bold">
                            {stats.MostWins?.Value} انتصارات
                        </p>
                    </div>
                    <span className="absolute -bottom-2 -left-2 text-7xl opacity-20">🏆</span>
                </div>

            </div>
        </div>
    );
}