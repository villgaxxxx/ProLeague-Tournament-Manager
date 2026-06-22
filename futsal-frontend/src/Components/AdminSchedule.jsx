import { useState, useEffect } from 'react';

export default function AdminSchedule() {
    const [drafts, setDrafts] = useState([]);
    const isAdmin = !!localStorage.getItem('adminToken');

    const fetchDrafts = () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;
        
        fetch('/api/Tournament/draft-matches', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => setDrafts(Array.isArray(data) ? data : data?.$values || []));
    };

    useEffect(() => { fetchDrafts(); }, []);

    const handleGenerate = async () => {
        const token = localStorage.getItem('adminToken');
        const res = await fetch('/api/Tournament/generate-schedule', {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message || data.Message);
        fetchDrafts();
    };

    const handleDateChange = async (matchId, newDate) => {
        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Tournament/update-date/${matchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(newDate)
        });
        fetchDrafts();
    };

    const handlePublish = async () => {
        const confirm = window.confirm("هل أنت متأكد؟ سيتم عرض هذه المواعيد للجمهور في شاشة المباريات!");
        if (!confirm) return;

        const token = localStorage.getItem('adminToken');
        const res = await fetch('/api/Tournament/publish-matches', {
            method: 'PUT', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message || data.Message);
        fetchDrafts();
    };

    if (!isAdmin) return null;

    return (
        <div className="max-w-4xl mx-auto mt-8 px-4" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-8 text-indigo-900">غرفة جدولة المجموعات 🗓️ (سري)</h2>

            <div className="flex justify-center gap-4 mb-8">
                <button onClick={handleGenerate} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-indigo-700 shadow">
                    1. توليد مباريات المجموعات تلقائياً ⚙️
                </button>

                {drafts.length > 0 && (
                    <button onClick={handlePublish} className="bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 shadow animate-bounce">
                        2. ترحيل ونشر المباريات للجمهور 🚀
                    </button>
                )}
            </div>

            {drafts.length > 0 ? (
                <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-dashed border-indigo-200">
                    <h3 className="font-bold text-gray-700 mb-4 text-center">قم بتعديل تواريخ المباريات قبل النشر:</h3>
                    <div className="grid gap-4">
                        {drafts.map(match => (
                            <div key={match.id || match.Id} className="flex flex-col md:flex-row justify-between items-center bg-gray-50 p-4 rounded-lg border">
                                <span className="font-black text-lg text-blue-900 w-1/3 text-center">{match.team1?.name || match.team1?.Name}</span>
                                <span className="text-gray-400 font-bold px-4">ضد</span>
                                <span className="font-black text-lg text-blue-900 w-1/3 text-center">{match.team2?.name || match.team2?.Name}</span>
                                
                                <input 
                                    type="datetime-local" 
                                    value={match.matchDate.substring(0, 16)} 
                                    onChange={(e) => handleDateChange(match.id || match.Id, e.target.value)}
                                    className="border rounded p-2 text-sm font-bold bg-white focus:outline-none focus:border-indigo-500 mt-3 md:mt-0"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-center text-gray-500 font-bold">لا توجد مباريات مسودة حالياً.</p>
            )}
        </div>
    );
}