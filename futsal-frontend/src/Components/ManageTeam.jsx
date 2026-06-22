import { useState, useEffect } from 'react';

export default function ManageTeam() {
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // 1. جلب الفرق أول ما الشاشة تفتح
    useEffect(() => {
        fetch('http://proleague-api.somee.com/api/teams')
            .then(res => res.json())
            .then(data => setTeams(data))
            .catch(err => console.error("مشكلة في جلب الفرق:", err));
    }, []);

    // 2. جلب تشكيلة الفريق لما الإدمن يختار فريق
    const handleTeamChange = async (e) => {
        const teamId = e.target.value;
        setSelectedTeam(teamId);
        fetchTeamPlayers(teamId);
    };

    const fetchTeamPlayers = async (teamId) => {
        setLoadingPlayers(true);
        try {
            const response = await fetch(`http://proleague-api.somee.com/api/Players/team/${teamId}`);
            if (response.ok) {
                const data = await response.json();
                setPlayers(data);
            }
        } catch (error) {
            console.error("مشكلة في جلب اللاعبين:", error);
        }
        setLoadingPlayers(false);
    };

    // 3. دالة تسجيل الهدف
    const handleAddGoal = async (playerId, playerName) => {
        const token = localStorage.getItem('adminToken');
        try {
            const response = await fetch(`http://proleague-api.somee.com/api/Players/${playerId}/addgoal`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // تحديث قائمة اللاعبين فوراً عشان الرقم يتغير على الشاشة
                fetchTeamPlayers(selectedTeam);
                alert(`جوووووول! ⚽ تم تسجيل الهدف للكابتن ${playerName}`);
            } else {
                alert("حصلت مشكلة أثناء تسجيل الهدف ❌");
            }
        } catch (error) {
            alert("مشكلة في الاتصال بالسيرفر ⚠️");
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto mt-10" dir="rtl">
            <h2 className="text-2xl font-black text-center mb-6 text-gray-800">إدارة تشكيلات الفرق 📋</h2>

            <div className="mb-6">
                <label className="block text-gray-700 font-bold mb-2">اختر الفريق لعرض لاعبيه:</label>
                <select 
                    value={selectedTeam}
                    onChange={handleTeamChange} 
                    className="w-full p-3 border rounded bg-gray-50 focus:outline-none focus:border-blue-500"
                >
                    <option value="" disabled>-- اختر الفريق --</option>
                    {teams.map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                </select>
            </div>

            {loadingPlayers ? (
                <div className="text-center font-bold text-gray-600">جاري تحميل التشكيلة... ⏳</div>
            ) : selectedTeam && players.length === 0 ? (
                <div className="text-center font-bold text-red-500 bg-red-50 p-4 rounded">هذا الفريق لم يسجل أي لاعبين حتى الآن!</div>
            ) : selectedTeam && players.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-center border-collapse">
                        <thead>
                            <tr className="bg-gray-800 text-white">
                                <th className="p-3 border font-bold">اسم اللاعب</th>
                                <th className="p-3 border font-bold">الأهداف الحالية</th>
                                <th className="p-3 border font-bold">إضافة هدف</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((player) => (
                                <tr key={player.id} className="hover:bg-gray-50 transition">
                                    <td className="p-3 border font-bold text-gray-800">{player.name}</td>
                                    <td className="p-3 border text-xl font-black text-blue-700">{player.goals}</td>
                                    <td className="p-3 border">
                                        <button 
    onClick={() => handleAddGoal(player.id || player.Id, player.name || player.Name)}
    className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 transition"
>
    +1 جول ⚽
</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    );
}