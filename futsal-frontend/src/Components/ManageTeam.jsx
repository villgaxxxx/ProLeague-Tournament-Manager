import { useState, useEffect } from 'react';

export default function ManageTeam() {
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // 1. جلب الفرق أول ما الشاشة تفتح
    useEffect(() => {
        fetch('/api/teams')
            .then(res => res.json())
            .then(data => {
                // تأمين الداتا لو راجعة من السيرفر جوه $values
                setTeams(Array.isArray(data) ? data : data?.$values || []);
            })
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
            const response = await fetch(`/api/Players/team/${teamId}`);
            if (response.ok) {
                const data = await response.json();
                setPlayers(Array.isArray(data) ? data : data?.$values || []);
            }
        } catch (error) {
            console.error("مشكلة في جلب اللاعبين:", error);
        }
        setLoadingPlayers(false);
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-3xl mx-auto mt-10 mb-10" dir="rtl">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-6 text-gray-800">إحصائيات وتشكيلة الفريق 📋</h2>

            <div className="mb-6">
                <label className="block text-gray-700 font-bold mb-2">اختر الفريق لعرض لاعبيه وإحصائياتهم:</label>
                <select 
                    value={selectedTeam}
                    onChange={handleTeamChange} 
                    className="w-full p-3 border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-700 shadow-sm"
                >
                    <option value="" disabled>-- اختر الفريق --</option>
                    {teams.map(team => (
                        <option key={team.id || team.Id} value={team.id || team.Id}>
                            {team.name || team.Name}
                        </option>
                    ))}
                </select>
            </div>

            {loadingPlayers ? (
                <div className="text-center font-bold text-gray-600 my-8">جاري تحميل التشكيلة... ⏳</div>
            ) : selectedTeam && players.length === 0 ? (
                <div className="text-center font-bold text-red-500 bg-red-50 p-4 rounded-lg border border-red-200">
                    هذا الفريق لم يسجل أي لاعبين حتى الآن!
                </div>
            ) : selectedTeam && players.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    {/* ضفنا whitespace-nowrap عشان نمنع الكلام من إنه يكسر على سطرين في الموبايل */}
                    <table className="w-full text-center border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-gray-800 text-white text-xs sm:text-base">
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">اسم اللاعب</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">الأهداف ⚽</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">إنذارات 🟨</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">طرود 🟥</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((player, index) => (
                                <tr key={player.id || player.Id} className={`transition duration-150 text-sm sm:text-base ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                                    <td className="p-3 sm:p-4 border-b font-bold text-gray-800">
                                        {player.name || player.Name}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b text-lg sm:text-xl font-black text-blue-700 bg-blue-50/30">
                                        {player.goals || player.Goals || 0}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b text-lg sm:text-xl font-black text-yellow-600 bg-yellow-50/30">
                                        {player.yellowCards || player.YellowCards || 0}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b text-lg sm:text-xl font-black text-red-600 bg-red-50/30">
                                        {player.redCards || player.RedCards || 0}
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