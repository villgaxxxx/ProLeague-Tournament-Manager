import { useState, useEffect } from 'react';

export default function TournamentManager() {
    const [settings, setSettings] = useState({ isHomeAway: false, groupSize: 4, enableBestThirds: false, isGroupStageDrawn: false });
    const [groups, setGroups] = useState([]);
    const isAdmin = !!localStorage.getItem('adminToken');

    // ⚠️ تنبيه: لو لسه بيظهرلك إيرور 500 من Vercel، تأكد إنك بتكتب الرابط الكامل للسيرفر بدل '/api/...'
    const fetchSettingsAndGroups = () => {
        fetch('/api/Tournament/settings') // عدل الرابط هنا لو لزم الأمر
            .then(res => res.json())
            .then(data => setSettings(data));

        fetch('/api/Tournament/groups') // وهنا
            .then(res => res.json())
            .then(data => {
                const groupsData = Array.isArray(data) ? data : (data?.$values || []);
                setGroups(groupsData);
            });
    };

    useEffect(() => { fetchSettingsAndGroups(); }, []);

    const handleSaveSettings = async () => {
        const token = localStorage.getItem('adminToken');
        const res = await fetch('/api/Tournament/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(settings)
        });
        const data = await res.json();
        alert(data.message || data.Message);
    };

    // 🔥 دالة القرعة المدمجة (فحص + سحب)
    const handleDrawGroups = async () => {
        try {
            // 1. جلب الفرق من السيرفر لفحص عدد اللاعبين قبل القرعة
            const teamsRes = await fetch('/api/teams');
            const teamsData = await teamsRes.json();
            const teamsList = Array.isArray(teamsData) ? teamsData : (teamsData?.$values || []);

            // 2. فلترة الفرق اللي عدد لاعبيها أقل من 5
            const invalidTeams = teamsList.filter(team => {
                // التعامل مع الداتا سواء جاية array عادي أو منقحة من .NET بـ $values
                const players = Array.isArray(team.players) ? team.players : (team.players?.$values || team.Players?.$values || team.Players || []);
                return players.length < 5;
            });

            // 3. لو في فرق ناقصة، نوقف العملية ونطلع تنبيه
            if (invalidTeams.length > 0) {
                const teamNames = invalidTeams.map(t => t.name || t.Name).join('، ');
                alert(`⚠️ لا يمكن إجراء القرعة!\nالفرق التالية تمتلك أقل من 5 لاعبين:\n${teamNames}`);
                return; // إيقاف التنفيذ، مش هنبعت طلب القرعة للسيرفر
            }

            // 4. لو الفرق كاملة، نأخذ تأكيد الأدمن
            const confirmDraw = window.confirm("هل أنت متأكد؟ سحب القرعة سيوزع الفرق عشوائياً ولن تتمكن من تغيير حجم المجموعة بعدها!");
            if (!confirmDraw) return;

            // 5. إرسال طلب سحب القرعة للسيرفر
            const token = localStorage.getItem('adminToken');
            const res = await fetch('/api/Tournament/draw-groups', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (res.ok) {
                alert("تم سحب القرعة بنجاح! 🎲");
                fetchSettingsAndGroups(); // تحديث الشاشة لعرض المجموعات
            } else {
                alert(data.message || data.Message);
            }
        } catch (error) {
            console.error("حدث خطأ أثناء عملية القرعة:", error);
            alert("حدث خطأ أثناء الاتصال بالسيرفر، يرجى المحاولة مرة أخرى.");
        }
    };

    if (!isAdmin && !settings.isGroupStageDrawn) {
        return <div className="text-center mt-10 font-bold text-xl text-gray-500">لم يتم سحب قرعة البطولة بعد ⏳</div>;
    }

    return (
        <div className="max-w-5xl mx-auto mt-8 px-4" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-8 text-blue-900">إدارة نظام البطولة 🏆</h2>

            {/* لوحة تحكم الإدمن */}
            {isAdmin && (
                <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 mb-8">
                    <h3 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">إعدادات وقواعد المسابقة ⚙️</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                            <span className="font-bold text-gray-700">نظام ذهاب وإياب</span>
                            <input type="checkbox" checked={settings.isHomeAway} onChange={e => setSettings({...settings, isHomeAway: e.target.checked})} className="w-5 h-5 cursor-pointer"/>
                        </div>

                        <div className="flex items-center justify-between bg-gray-50 p-3 rounded border">
                            <span className="font-bold text-gray-700">تأهيل أفضل ثوالث</span>
                            <input type="checkbox" checked={settings.enableBestThirds} onChange={e => setSettings({...settings, enableBestThirds: e.target.checked})} className="w-5 h-5 cursor-pointer"/>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={handleSaveSettings} className="flex-1 bg-gray-800 text-white font-bold py-2 rounded hover:bg-black transition">
                            حفظ الإعدادات 💾
                        </button>
                        
                        {!settings.isGroupStageDrawn ? (
                            <button onClick={handleDrawGroups} className="flex-1 bg-green-600 text-white font-bold py-2 rounded hover:bg-green-700 transition shadow-lg animate-pulse">
                                إجراء القرعة العشوائية 🎲
                            </button>
                        ) : (
                            <button disabled className="flex-1 bg-gray-300 text-gray-600 font-bold py-2 rounded cursor-not-allowed">
                                تم سحب القرعة بالفعل ✅
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* عرض المجموعات */}
            {settings.isGroupStageDrawn && (
                <div>
                    <h3 className="text-2xl font-black text-center mb-6 text-gray-800">نتائج القرعة والمجموعات 📋</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.map((group, idx) => {
                            const teamsArray = Array.isArray(group.teams) ? group.teams : (group.teams?.$values || []);
                            return (
                                <div key={idx} className="bg-white rounded-xl shadow-lg overflow-hidden border-t-8 border-blue-800">
                                    <div className="bg-gray-100 text-center py-3 border-b border-gray-200">
                                        <h4 className="text-xl font-black text-blue-900">المجموعة {group.groupName || group.GroupName}</h4>
                                    </div>
                                    <ul className="divide-y divide-gray-100">
                                        {teamsArray.map((team, tIdx) => (
                                            <li key={team.id || team.Id} className="p-4 flex items-center gap-3 hover:bg-blue-50 transition">
                                                <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex justify-center items-center font-bold text-sm">
                                                    {tIdx + 1}
                                                </span>
                                                <span className="font-bold text-gray-800">{team.name || team.Name}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}