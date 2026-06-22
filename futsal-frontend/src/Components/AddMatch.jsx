import { useState, useEffect } from 'react';

export default function AddMatch() {
    const [teams, setTeams] = useState([]);
    const [formData, setFormData] = useState({ team1Id: '', team2Id: '', matchDate: '' });

    useEffect(() => {
        fetch('http://proleague-api.somee.com/api/teams')
            .then(res => res.json())
            .then(data => {
                // أمان إضافي: لو الداتا راجعة مصفوفة مباشرة أو مغلفة جوه $values هيلقطها في الحالتين
                const teamsData = Array.isArray(data) ? data : (data?.$values || []);
                setTeams(teamsData);
            })
            .catch(err => console.error("Error fetching teams:", err));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.team1Id === formData.team2Id) return alert("لا يمكن للفريق اللعب ضد نفسه!");

        const token = localStorage.getItem('adminToken');
        const response = await fetch('http://proleague-api.somee.com/api/Matches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                team1Id: parseInt(formData.team1Id),
                team2Id: parseInt(formData.team2Id),
                matchDate: formData.matchDate
            })
        });

        if (response.ok) {
            alert("تمت جدولة المباراة بنجاح! 📅");
            setFormData({ team1Id: '', team2Id: '', matchDate: '' });
        }
    };

    return (
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md mx-auto mt-10">
            <h2 className="text-2xl font-black text-center mb-6 text-gray-800">جدولة مباراة ⏱️</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* القائمة الأولى */}
                <select 
                    required 
                    value={formData.team1Id}
                    onChange={e => setFormData({...formData, team1Id: e.target.value})} 
                    className="w-full p-3 border rounded bg-gray-50 text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="" className="bg-white text-gray-500">-- الفريق الأول --</option>
                    {teams.map(t => (
                        <option 
                            key={t.id || t.Id} 
                            value={t.id || t.Id} 
                            className="bg-white text-gray-900 font-bold p-2" // تجبر الخط يظهر داكن على خلفية بيضاء
                        >
                            {t.name || t.Name}
                        </option>
                    ))}
                </select>
                
                <div className="text-center font-bold text-gray-500">ضد</div>
                
                {/* القائمة الثانية */}
                <select 
                    required 
                    value={formData.team2Id}
                    onChange={e => setFormData({...formData, team2Id: e.target.value})} 
                    className="w-full p-3 border rounded bg-gray-50 text-gray-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="" className="bg-white text-gray-500">-- الفريق الثاني --</option>
                    {teams.map(t => (
                        <option 
                            key={t.id || t.Id} 
                            value={t.id || t.Id} 
                            className="bg-white text-gray-900 font-bold p-2" // تجبر الخط يظهر داكن على خلفية بيضاء
                        >
                            {t.name || t.Name}
                        </option>
                    ))}
                </select>
                
                {/* حقل الوقت والتاريخ */}
                <input 
                    type="datetime-local" 
                    required 
                    value={formData.matchDate}
                    onChange={e => setFormData({...formData, matchDate: e.target.value})} 
                    className="w-full p-3 border rounded bg-gray-50 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button type="submit" className="w-full bg-blue-800 text-white font-bold py-3 rounded hover:bg-blue-900 transition mt-4 shadow-md">
                    تأكيد المباراة 📅
                </button>
            </form>
        </div>
    );
}