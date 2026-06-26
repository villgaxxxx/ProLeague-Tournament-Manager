import { useState, useEffect } from 'react';

export default function ManageTeam() {
    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // 🆕 متغيرات إضافة لاعب جديد
    const [newPlayerName, setNewPlayerName] = useState("");
    const [newPlayerPosition, setNewPlayerPosition] = useState("مهاجم");

    const token = localStorage.getItem('adminToken');

    // 1. جلب الفرق أول ما الشاشة تفتح
    useEffect(() => {
        fetch('/api/teams')
            .then(res => res.json())
            .then(data => {
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
            // استخدمنا المسار اللي ضفناه في الباك إند
            const response = await fetch(`/api/teams/${teamId}/players`);
            if (response.ok) {
                const data = await response.json();
                setPlayers(Array.isArray(data) ? data : data?.$values || []);
            }
        } catch (error) {
            console.error("مشكلة في جلب اللاعبين:", error);
        }
        setLoadingPlayers(false);
    };

    // 3. 🆕 دالة إضافة لاعب جديد
    const handleAddPlayer = async (e) => {
        e.preventDefault();
        if (!newPlayerName.trim()) return alert("⚠️ الرجاء كتابة اسم اللاعب");

        try {
            const res = await fetch(`/api/teams/${selectedTeam}/players`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    Name: newPlayerName, 
                    Position: newPlayerPosition 
                })
            });

            if (res.ok) {
                const addedPlayer = await res.json();
                setPlayers([...players, addedPlayer]); // تحديث الجدول فوراً
                setNewPlayerName(""); // تفريغ حقل الاسم
            } else {
                alert("حدث خطأ أثناء إضافة اللاعب.");
            }
        } catch (error) {
            console.error(error);
        }
    };

    // 4. 🆕 دالة حذف لاعب
    const handleDeletePlayer = async (playerId) => {
        if (!window.confirm("هل أنت متأكد من حذف هذا اللاعب من الفريق؟")) return;

        try {
            const res = await fetch(`/api/teams/players/${playerId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                setPlayers(players.filter(p => (p.id || p.Id) !== playerId));
            }
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-4xl mx-auto mt-10 mb-10" dir="rtl">
            <h2 className="text-2xl sm:text-3xl font-black text-center mb-6 text-gray-800">إدارة قوائم الفرق (السكواد) 📋</h2>

            {/* اختيار الفريق */}
            <div className="mb-6">
                <label className="block text-gray-700 font-bold mb-2">اختر الفريق لعرض وإدارة لاعبيه:</label>
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

            {/* 🆕 فورم الإضافة تظهر فقط لو الإدمن اختار فريق */}
            {selectedTeam && (
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-6 shadow-sm">
                    <h3 className="font-bold text-indigo-900 mb-3">➕ إضافة لاعب جديد للفريق</h3>
                    <form onSubmit={handleAddPlayer} className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1 w-full">
                            <label className="text-sm font-bold text-gray-700">اسم اللاعب</label>
                            <input 
                                type="text" 
                                value={newPlayerName} 
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                placeholder="مثال: أحمد محمد"
                                className="w-full border p-2 rounded mt-1 outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-sm font-bold text-gray-700">المركز (للفانتازي)</label>
                            <select 
                                value={newPlayerPosition} 
                                onChange={(e) => setNewPlayerPosition(e.target.value)}
                                className="w-full border p-2 rounded mt-1 font-bold outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                                <option value="حارس مرمى">🧤 حارس مرمى</option>
                                <option value="مدافع">🛡️ مدافع</option>
                                <option value="خط وسط">👟 خط وسط</option>
                                <option value="مهاجم">⚽ مهاجم (بيفو)</option>
                            </select>
                        </div>
                        <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded transition shadow-md w-full sm:w-auto h-[42px]">
                            إضافة
                        </button>
                    </form>
                </div>
            )}

            {/* عرض اللاعبين */}
            {loadingPlayers ? (
                <div className="text-center font-bold text-gray-600 my-8">جاري تحميل التشكيلة... ⏳</div>
            ) : selectedTeam && players.length === 0 ? (
                <div className="text-center font-bold text-red-500 bg-red-50 p-4 rounded-lg border border-red-200">
                    هذا الفريق لم يسجل أي لاعبين حتى الآن!
                </div>
            ) : selectedTeam && players.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                    <table className="w-full text-center border-collapse whitespace-nowrap">
                        <thead>
                            <tr className="bg-gray-800 text-white text-xs sm:text-base">
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold text-right">اسم اللاعب</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">المركز</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">الأهداف ⚽</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">إنذارات 🟨</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">طرود 🟥</th>
                                <th className="p-3 sm:p-4 border-b-2 border-gray-900 font-bold">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {players.map((player, index) => (
                                <tr key={player.id || player.Id} className={`transition duration-150 text-sm sm:text-base ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                                    <td className="p-3 sm:p-4 border-b font-bold text-gray-800 text-right">
                                        {player.name || player.Name}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b text-sm font-bold text-indigo-700">
                                        <span className="bg-indigo-50 px-2 py-1 rounded">
                                            {player.position || player.Position || "غير محدد"}
                                        </span>
                                    </td>
                                    <td className="p-3 sm:p-4 border-b text-lg font-black text-green-700 bg-green-50/20">
                                        {player.goals || player.Goals || 0}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b text-lg font-black text-yellow-600 bg-yellow-50/20">
                                        {player.yellowCards || player.YellowCards || 0}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b text-lg font-black text-red-600 bg-red-50/20">
                                        {player.redCards || player.RedCards || 0}
                                    </td>
                                    <td className="p-3 sm:p-4 border-b">
                                        <button 
                                            onClick={() => handleDeletePlayer(player.id || player.Id)}
                                            className="text-red-500 hover:text-white hover:bg-red-500 border border-red-500 px-3 py-1 rounded transition font-bold text-sm"
                                        >
                                            حذف 🗑️
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