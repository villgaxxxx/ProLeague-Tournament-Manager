import { useState, useEffect } from 'react';

export default function TeamsList() {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedTeams, setExpandedTeams] = useState({});
    
    // 🔥 حالة أقصى عدد للاعبين (الافتراضي 8 لحد ما ييجي من السيرفر)
    const [maxPlayers, setMaxPlayers] = useState(8);
    
    const [teamsPerGroup, setTeamsPerGroup] = useState(4); 
    const isAdmin = !!localStorage.getItem('adminToken');

    const fetchTeams = () => {
        fetch('/api/teams')
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
        
        // ⚙️ جلب إعدادات البطولة لمعرفة أقصى عدد لاعبين ديناميكياً
        fetch('/api/Tournament/settings')
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setMaxPlayers(data.maxPlayers || data.MaxPlayers || 8);
                }
            })
            .catch(err => console.error("Error fetching settings:", err));
    }, []);

    const toggleTeam = (teamId) => {
        setExpandedTeams(prev => ({
            ...prev,
            [teamId]: !prev[teamId]
        }));
    };

    const handlePotChange = async (teamId, newPot) => {
        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch(`/api/Teams/update-pot/${teamId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify(parseInt(newPot))
            });

            if (response.ok) {
                setTeams(teams.map(t => 
                    (t.id === teamId || t.Id === teamId) 
                        ? { ...t, potLevel: parseInt(newPot), PotLevel: parseInt(newPot) } 
                        : t
                ));
            } else {
                alert("حدث خطأ أثناء تحديث التصنيف.");
            }
        } catch (error) {
            console.error("Error updating pot:", error);
            alert("مشكلة في الاتصال بالسيرفر.");
        }
    };

    const handleDeletePlayer = async (playerId, playerName) => {
        const confirmDelete = window.confirm(`هل أنت متأكد من حذف اللاعب "${playerName}"؟ لا يمكن التراجع عن هذه الخطوة.`);
        if (!confirmDelete) return;

        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch(`/api/Players/${playerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                alert("تم حذف اللاعب بنجاح! 🗑️");
                fetchTeams(); 
            } else {
                alert("حدث خطأ أثناء حذف اللاعب.");
            }
        } catch (error) {
            alert("مشكلة في الاتصال بالسيرفر.");
        }
    };

    const handleDeleteTeam = async (teamId, teamName) => {
        const confirmDelete = window.confirm(`⚠️ تحذير خطير جداً!\nهل أنت متأكد من حذف فريق "${teamName}" بالكامل؟\nهذا الإجراء سيمسح الفريق وجميع اللاعبين المسجلين فيه نهائياً!`);
        if (!confirmDelete) return;

        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch(`/api/Teams/${teamId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                alert(data.message || data.Message || "تم حذف الفريق بنجاح! 🗑️");
                fetchTeams(); 
            } else {
                alert(data.message || data.Message || "حدث خطأ أثناء حذف الفريق.");
            }
        } catch (error) {
            console.error("Error deleting team:", error);
            alert("مشكلة في الاتصال بالسيرفر.");
        }
    };

    if (loading) return <div className="text-center mt-10 font-bold text-xl text-gray-700">جاري تحميل الفرق... ⏳</div>;

    return (
        <div className="max-w-4xl mx-auto mt-8 px-4 pb-12" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-8 text-gray-800">الفرق المشاركة في البطولة 🏃‍♂️</h2>

            {isAdmin && teams.length > 0 && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 mb-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2">
                        <span>🏆</span> إعدادات تصنيف القرعة:
                    </h3>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-gray-700">عدد الفرق بالمجموعة:</label>
                        <select 
                            value={teamsPerGroup} 
                            onChange={(e) => setTeamsPerGroup(Number(e.target.value))}
                            className="bg-blue-50 border border-blue-200 text-blue-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 font-bold cursor-pointer"
                        >
                            <option value={3}>3 فرق (أقصى تصنيف: 3)</option>
                            <option value={4}>4 فرق (أقصى تصنيف: 4)</option>
                            <option value={5}>5 فرق (أقصى تصنيف: 5)</option>
                        </select>
                    </div>
                </div>
            )}

            {teams.length === 0 ? (
                <p className="text-center text-gray-500 font-bold text-lg">لم يتم تسجيل أي فرق حتى الآن.</p>
            ) : (
                <div className="grid gap-4">
                    {teams.map(team => {
                        const teamId = team.id || team.Id;
                        const isExpanded = !!expandedTeams[teamId];
                        const playersList = team.players || team.Players || [];
                        const players = Array.isArray(playersList) ? playersList : (playersList?.$values || []);
                        const currentPot = team.potLevel || team.PotLevel || "";

                        return (
                            <div key={teamId} className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-200">
                                
                                {isAdmin && (
                                    <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex justify-between items-center flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs sm:text-sm font-bold text-amber-900">
                                                تصنيف الفريق للقرعة:
                                            </span>
                                            <select 
                                                value={currentPot}
                                                onChange={(e) => handlePotChange(teamId, e.target.value)}
                                                className="bg-white border border-amber-300 text-amber-900 text-xs sm:text-sm rounded focus:ring-amber-500 focus:border-amber-500 p-1 font-bold cursor-pointer"
                                            >
                                                <option value="" disabled>غير مصنف</option>
                                                {[...Array(teamsPerGroup)].map((_, i) => (
                                                    <option key={i + 1} value={i + 1}>تصنيف {i + 1}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <button
                                            onClick={() => handleDeleteTeam(teamId, team.name || team.Name)}
                                            className="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 hover:border-red-600 px-3 py-1 rounded text-xs font-black transition shadow-sm flex items-center gap-1 cursor-pointer"
                                            title="حذف الفريق نهائياً"
                                        >
                                            <span>حذف الفريق</span> 🗑️
                                        </button>
                                    </div>
                                )}

                                <button 
                                    onClick={() => toggleTeam(teamId)}
                                    className="w-full p-5 flex justify-between items-center bg-gradient-to-r from-blue-800 to-blue-900 text-white font-bold focus:outline-none hover:opacity-95 transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🛡️</span>
                                        <div className="text-right">
                                            <h3 className="text-xl font-black">{team.name || team.Name}</h3>
                                            
                                            {/* 👇 التعديل هنا: قراءة أقصى عدد لاعبين من المتغير maxPlayers 👇 */}
                                            <p className="text-xs text-blue-200 mt-0.5">الكابتن: {team.captainName || team.CaptainName} | {players.length} / {maxPlayers} لاعبين</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-4">
                                        {currentPot && (
                                            <span className="bg-amber-400 text-amber-950 text-[10px] sm:text-xs font-black px-2 py-1 rounded shadow-sm">
                                                تصنيف {currentPot}
                                            </span>
                                        )}
                                        <svg 
                                            className={`w-6 h-6 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : 'rotate-0'}`} 
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </button>

                                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-96 border-t border-gray-100' : 'max-h-0'}`}>
                                    <div className="p-4 bg-gray-50 overflow-y-auto">
                                        {players.length === 0 ? (
                                            <p className="text-gray-500 text-center py-2 text-sm font-bold">لا يوجد لاعبين مسجلين في هذا الفريق بعد.</p>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2">
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