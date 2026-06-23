import { useState, useEffect } from 'react';

export default function Leaderboard() {
    const [teams, setTeams] = useState([]);
    const [bestThirds, setBestThirds] = useState([]);
    const [settings, setSettings] = useState({ enableBestThirds: false });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. جلب الفرق
        fetch('/api/teams')
            .then(res => res.json())
            .then(data => setTeams(Array.isArray(data) ? data : data?.$values || []))
            .catch(err => console.error(err));

        // 2. جلب إعدادات البطولة
        fetch('/api/Tournament/settings')
            .then(res => res.json())
            .then(data => {
                setSettings(data);
                // لو أوبشن أفضل ثوالث شغال، نجيب جدول الثوالث
                if (data.enableBestThirds || data.EnableBestThirds) {
                    fetch('/api/Tournament/best-thirds')
                        .then(r => r.json())
                        .then(thirdsData => setBestThirds(Array.isArray(thirdsData) ? thirdsData : thirdsData?.$values || []));
                }
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="text-center mt-10 font-bold text-xl text-gray-700">جاري تحميل الجداول... ⏳</div>;

    const hasGroups = teams.some(t => t.groupName || t.GroupName);

    if (!hasGroups) {
        return (
            <div className="max-w-4xl mx-auto mt-8 px-4" dir="rtl">
                <h2 className="text-3xl font-black text-center mb-6 text-gray-800">ترتيب البطولة 🏆</h2>
                <div className="bg-white p-8 rounded-xl shadow-md text-center border-t-4 border-gray-300">
                    <p className="font-bold text-gray-500 text-lg">لم يتم سحب قرعة المجموعات حتى الآن. يرجى الانتظار! ⏳</p>
                </div>
            </div>
        );
    }

    const groupedTeams = teams.reduce((acc, team) => {
        const group = team.groupName || team.GroupName || 'غير محدد';
        if (!acc[group]) acc[group] = [];
        acc[group].push(team);
        return acc;
    }, {});

    const sortedGroupNames = Object.keys(groupedTeams).sort();

    return (
        <div className="max-w-5xl mx-auto mt-8 px-4 mb-16" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-8 text-gray-800">ترتيب المجموعات 🏆</h2>
            
            {/* 1. جداول المجموعات العادية */}
            <div className="grid gap-8 grid-cols-1">
                {sortedGroupNames.map(groupName => {
                    const groupTeams = groupedTeams[groupName].sort((a, b) => {
                        if (b.points !== a.points) return b.points - a.points;
                        const gdA = a.goalsFor - a.goalsAgainst;
                        const gdB = b.goalsFor - b.goalsAgainst;
                        if (gdB !== gdA) return gdB - gdA;
                        return b.goalsFor - a.goalsFor;
                    });

                    return (
                        <div key={groupName} className="bg-white rounded-xl shadow-lg overflow-hidden border-t-8 border-indigo-800">
                            <div className="bg-indigo-50 py-3 px-6 border-b border-indigo-100">
                                <h3 className="text-2xl font-black text-indigo-900">المجموعة {groupName}</h3>
                            </div>
                            <div className="overflow-x-auto">
    <table className="w-full text-center">
        <thead className="bg-gray-800 text-white font-bold text-sm">
            <tr>
                <th className="p-3">#</th>
                <th className="p-3 text-right">الفريق</th>
                <th className="p-3" title="لعب">لعب</th>
                {/* العواميد الجديدة */}
                <th className="p-3 text-green-400" title="فوز">ف</th>
                <th className="p-3 text-yellow-400" title="تعادل">ت</th>
                <th className="p-3 text-red-400" title="خسارة">خ</th>
                {/* بقية العواميد */}
                <th className="p-3" title="أهداف له">له</th>
                <th className="p-3" title="أهداف عليه">عليه</th>
                <th className="p-3" title="فارق الأهداف">+/-</th>
                <th className="p-3 text-yellow-400">النقاط</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
            {groupTeams.map((team, index) => {
                // التأكد من إن القيم مش Null
                const wins = team.wins || 0;
                const draws = team.draws || 0;
                const losses = team.losses || 0;
                
                const played = wins + draws + losses;
                const gd = (team.goalsFor || 0) - (team.goalsAgainst || 0);
                const isTop2 = index < 2;
                const rowBg = isTop2 ? 'bg-green-100 hover:bg-green-200' : 'bg-white hover:bg-gray-50';

                return (
                    <tr key={team.id || team.Id} className={`transition duration-150 ${rowBg}`}>
                        <td className="p-3 font-bold text-gray-700">{index + 1}</td>
                        <td className="p-3 text-right font-black text-gray-900 flex items-center gap-2">
                            {isTop2 && <span className="text-green-700 text-lg">✅</span>}
                            {team.name || team.Name}
                        </td>
                        <td className="p-3 font-mono font-bold">{played}</td>
                        
                        {/* الداتا الجديدة بالألوان */}
                        <td className="p-3 font-mono font-bold text-green-600">{wins}</td>
                        <td className="p-3 font-mono font-bold text-amber-500">{draws}</td>
                        <td className="p-3 font-mono font-bold text-red-600">{losses}</td>
                        
                        <td className="p-3 font-mono">{team.goalsFor || 0}</td>
                        <td className="p-3 font-mono">{team.goalsAgainst || 0}</td>
                        <td className="p-3 font-mono font-bold" dir="ltr">{gd > 0 ? `+${gd}` : gd}</td>
                        <td className="p-3 font-black text-indigo-700 text-lg">{team.points || 0}</td>
                    </tr>
                );
            })}
        </tbody>
    </table>
</div>
                        </div>
                    );
                })}
            </div>

            {/* 2. جدول منافسة أفضل ثوالث (يظهر فقط لو الخيار مفعل) */}
            {(settings.enableBestThirds || settings.EnableBestThirds) && bestThirds.length > 0 && (
                <div className="mt-12 bg-white rounded-xl shadow-xl overflow-hidden border-t-8 border-yellow-500">
                    <div className="bg-yellow-50 py-4 px-6 border-b border-yellow-100 text-center">
                        <h3 className="text-2xl font-black text-yellow-800">📊 صراع أفضل ثوالث (ترتيب الفيفا واللعب النظيف)</h3>
                        <p className="text-xs text-yellow-600 font-bold mt-1">يتم احتساب الترتيب بناءً على: النقاط ثم فارق الأهداف ثم الأهداف له ثم نقاط الكروت النظيفة</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-center">
                            <thead className="bg-yellow-600 text-white font-bold text-sm">
                                <tr>
                                    <th className="p-3">#</th>
                                    <th className="p-3 text-right">الفريق</th>
                                    <th className="p-3">المجموعة</th>
                                    <th className="p-3">لعب</th>
                                    <th className="p-3">+/-</th>
                                    <th className="p-3" title="نقاط اللعب النظيف: خصم عن كل كارت">اللعب النظيف</th>
                                    <th className="p-3 text-yellow-100">النقاط</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {bestThirds.map((third, idx) => {
                                    const played = third.wins + third.draws + third.losses;
                                    // لنفرض مثلاً أن أفضل 4 ثوالث هما اللي هيتأهلوا لدور الـ 16
                                    const isQualifiedThird = idx < 4; 
                                    const rowBg = isQualifiedThird ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white hover:bg-gray-50';

                                    return (
                                        <tr key={third.teamId} className={`transition duration-150 ${rowBg}`}>
                                            <td className="p-3 font-bold text-gray-700">{idx + 1}</td>
                                            <td className="p-3 text-right font-black text-gray-900 flex items-center gap-2">
                                                {isQualifiedThird ? <span className="text-amber-600 text-lg">⭐</span> : <span className="text-gray-400 text-lg">❌</span>}
                                                {third.teamName}
                                            </td>
                                            <td className="p-3 font-bold text-blue-800">المجموعة {third.groupName}</td>
                                            <td className="p-3 font-mono">{played}</td>
                                            <td className="p-3 font-mono" dir="ltr">{third.goalDifference > 0 ? `+${third.goalDifference}` : third.goalDifference}</td>
                                            <td className="p-3 font-mono text-xs font-bold text-red-600" title="نقاط الخصم: أصفر -1، أحمر -4، أزرق -5">
                                                {third.fairPlayPoints} pts
                                            </td>
                                            <td className="p-3 font-black text-yellow-700 text-lg">{third.points}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}