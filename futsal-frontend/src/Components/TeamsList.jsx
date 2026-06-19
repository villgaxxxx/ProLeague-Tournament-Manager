import { useState, useEffect } from 'react';

export default function TeamsList() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedTeams, setExpandedTeams] = useState({});
    
    // التحقق إذا كان المستخدم إدمن لعرض أزرار الحذف
    const isAdmin = !!localStorage.getItem('adminToken');

    // فصلنا جلب البيانات في دالة لوحدها عشان نقدر نناديها بعد الحذف لتحديث الشاشة
    const fetchTeams = () => {
        fetch('https://proleague-api.somee.com/api/teams')
            .then(res => res.json())
            .then(data => {
                const teamsData = Array.isArray(data) ? data : (data?.$values || []);
                setTeams(teamsData);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching teams:", err);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchTeams();
    }, []);

    const toggleTeam = (teamId) => {
        setExpandedTeams(prev => ({
            ...prev,
            [teamId]: !prev[teamId]
        }));
    };

    // دالة حذف اللاعب
    const handleDeletePlayer = async (playerId, playerName) => {
        const confirmDelete = window.confirm(`هل أنت متأكد من حذف اللاعب "${playerName}"؟ لا يمكن التراجع عن هذه الخطوة.`);
        if (!confirmDelete) return;

        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch(`https://proleague-api.somee.com/api/Players/${playerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert("تم حذف اللاعب بنجاح! 🗑️");
                fetchTeams(); // تحديث القائمة فوراً
            } else {
                alert("حدث خطأ أثناء حذف اللاعب.");
            }
        } catch (error) {
            alert("مشكلة في الاتصال بالسيرفر.");
        }
    };

    if (loading) return <div className="text-center mt-10 font-bold text-xl text-gray-700">جاري تحميل الفرق... ⏳</div>;

    return (
        <div className="max-w-4xl mx-auto mt-8 px-4" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-8 text-gray-800">الفرق المشاركة في البطولة 🏃‍♂️</h2>

            {teams.length === 0 ? (
                <p className="text-center text-gray-500 font-bold text-lg">لم يتم تسجيل أي فرق حتى الآن.</p>
            ) : (
                <div className="grid gap-4">
                    {teams.map(team => {
                        const isExpanded = !!expandedTeams[team.id || team.Id];
                        const playersList = team.players || team.Players || [];
                        const players = Array.isArray(playersList) ? playersList : (playersList?.$values || []);

                        return (
                            <div key={team.id || team.Id} className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-200">
                                
                                <button 
                                    onClick={() => toggleTeam(team.id || team.Id)}
                                    className="w-full p-5 flex justify-between items-center bg-gradient-to-r from-blue-800 to-blue-900 text-white font-bold focus:outline-none hover:opacity-95 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🛡️</span>
                                        <div className="text-right">
                                            <h3 className="text-xl font-black">{team.name || team.Name}</h3>
                                            <p className="text-xs text-blue-200 mt-0.5">الكابتن: {team.captainName || team.CaptainName} | {players.length} / 8 لاعبين</p>
                                        </div>
                                    </div>
                                    
                                    <svg 
                                        className={`w-6 h-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} 
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 border-t border-gray-100' : 'max-h-0'}`}>
                                    <div className="p-4 bg-gray-50 overflow-y-auto">
                                        {players.length === 0 ? (
                                            <p className="text-gray-500 text-center py-2 text-sm font-bold">لا يوجد لاعبين مسجلين في هذا الفريق بعد.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {players.map((player, idx) => (
                                                    <div 
                                                        key={player.id || player.Id} 
                                                        className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="bg-blue-100 text-blue-800 font-mono font-bold w-6 h-6 rounded-full flex items-center justify-center text-xs">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="font-bold text-gray-800">{player.name || player.Name}</span>
                                                        </div>
                                                        
                                                        {/* زرار الحذف يظهر للإدمن فقط */}
                                                        {isAdmin && (
                                                            <button 
                                                                onClick={() => handleDeletePlayer(player.id || player.Id, player.name || player.Name)}
                                                                className="text-red-500 hover:text-white hover:bg-red-500 border border-red-500 px-2 py-1 rounded text-xs font-bold transition"
                                                                title="حذف اللاعب"
                                                            >
                                                                حذف 🗑️
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}