import { useState, useEffect } from 'react';

export default function TopScorers() {
    const [scorers, setScorers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://proleague-api.somee.com/api/Players/topscorers')
            .then(res => res.json())
            .then(data => {
                setScorers(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("مشكلة في الاتصال بالسيرفر:", err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="text-center mt-10 font-bold text-xl text-gray-700">جاري تحميل القائمة... ⏳</div>;

    return (
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-3xl mx-auto mt-8" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-6 text-gray-800">قائمة الهدافين 🏆⚽</h2>
            
            {scorers.length === 0 ? (
                <p className="text-center text-gray-500 font-bold text-lg">لسه مفيش أهداف اتسجلت في البطولة!</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-blue-800 text-white">
                                <th className="p-3 border font-bold">الترتيب</th>
                                <th className="p-3 border font-bold">اسم اللاعب</th>
                                <th className="p-3 border font-bold">الفريق</th>
                                <th className="p-3 border font-bold">الأهداف</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scorers.map((player, index) => (
                                <tr 
                                    key={player.playerId} 
                                    className={`transition duration-200 ${index === 0 ? "bg-yellow-100 font-bold transform scale-105 shadow-sm" : "hover:bg-gray-50"}`}
                                >
                                    <td className="p-3 border text-gray-700">{index + 1}</td>
                                    <td className="p-3 border text-gray-800">
                                        {player.playerName} {index === 0 && '👑'}
                                    </td>
                                    <td className="p-3 border text-gray-600">{player.teamName}</td>
                                    <td className="p-3 border text-2xl font-black text-blue-700">{player.goals}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}