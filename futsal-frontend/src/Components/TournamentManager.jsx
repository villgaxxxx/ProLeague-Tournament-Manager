import { useState, useEffect } from 'react';

export default function TournamentManager() {
    const [settings, setSettings] = useState({ isHomeAway: false, groupSize: 4, enableBestThirds: false, isGroupStageDrawn: false });
    const [groups, setGroups] = useState([]);
    const isAdmin = !!localStorage.getItem('adminToken');
    const [swapTeam1, setSwapTeam1] = useState("");
    const [swapTeam2, setSwapTeam2] = useState("");
    const [teams, setTeams] = useState([]);

// لو معندكش لستة الفرق كلها متخزنة في state، اتأكد إنك بتجيبها عشان نعرضها في القائمة

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

    // 🔥 دالة القرعة المدمجة (بدون شرط عدد اللاعبين)
const handleDrawGroups = async () => {
    try {
        const confirmDraw = window.confirm("هل أنت متأكد؟ سحب القرعة سيوزع الفرق عشوائياً ولن تتمكن من تغيير حجم المجموعة بعدها!");
        if (!confirmDraw) return;

        const token = localStorage.getItem('adminToken');
        const res = await fetch('/api/Tournament/draw-groups', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // 🛡️ حماية ضد إيرور الـ JSON لو السيرفر رجع صفحة فاضية أو 500
        let data;
        try {
            data = await res.json();
        } catch (e) {
            data = { Message: "حدث خطأ 500 في السيرفر الداخلي. راجع سجلات الباك إند." };
        }
        
        if (res.ok) {
            alert("تم سحب القرعة بنجاح! 🎲");
            fetchSettingsAndGroups();
        } else {
            alert(data.message || data.Message);
        }
    } catch (error) {
        console.error("حدث خطأ أثناء عملية القرعة:", error);
        alert("مشكلة في الاتصال بالسيرفر.");
    }
};

const handleSwapTeams = async () => {
    if (!swapTeam1 || !swapTeam2) return alert("⚠️ الرجاء اختيار الفريقين أولاً.");
    if (swapTeam1 === swapTeam2) return alert("⚠️ لا يمكن تبديل الفريق بنفسه!");

    const token = localStorage.getItem('adminToken');
    try {
        const res = await fetch('/api/Tournament/swap-teams', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify({
                Team1Id: parseInt(swapTeam1),
                Team2Id: parseInt(swapTeam2)
            })
        });
        
        const data = await res.json();
        if (res.ok) {
            alert(data.message || data.Message);
            setSwapTeam1("");
            setSwapTeam2("");
            // 🔄 هنا نادي على الدالة اللي بتجيب المجموعات تاني عشان الشاشة تعمل ريفرش
            // مثلاً: fetchGroups();
        } else {
            alert(data.message || data.Message);
        }
    } catch (error) {
        alert("مشكلة في الاتصال بالسيرفر.");
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

                {/* 🔄 واجهة تبديل الفرق (بتظهر بس لو القرعة اتعملت) */}
                <div className="bg-yellow-50 border border-yellow-300 p-6 rounded-xl shadow-sm mb-8 text-center max-w-4xl mx-auto" dir="rtl">
                    <h3 className="font-bold text-gray-800 mb-4">🔄 تبديل أماكن الفرق في المجموعات</h3>
                    
                    <div className="flex flex-col md:flex-row justify-center items-center gap-4">
                        <select 
                            value={swapTeam1} 
                            onChange={(e) => setSwapTeam1(e.target.value)}
                            className="border-2 border-gray-300 rounded-lg p-2 font-bold w-full md:w-64 focus:border-indigo-500 outline-none"
                        >
                            <option value="">-- اختر الفريق الأول --</option>
                            {teams.map(t => <option key={t.id || t.Id} value={t.id || t.Id}>{t.name || t.Name} (مجموعة {t.groupName || t.GroupName})</option>)}
                        </select>

                        <span className="text-2xl font-black text-gray-400 hidden md:block">↔️</span>

                        <select 
                            value={swapTeam2} 
                            onChange={(e) => setSwapTeam2(e.target.value)}
                            className="border-2 border-gray-300 rounded-lg p-2 font-bold w-full md:w-64 focus:border-indigo-500 outline-none"
                        >
                            <option value="">-- اختر الفريق الثاني --</option>
                            {teams.map(t => <option key={t.id || t.Id} value={t.id || t.Id}>{t.name || t.Name} (مجموعة {t.groupName || t.GroupName})</option>)}
                        </select>

                        <button 
                            onClick={handleSwapTeams}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg transition-transform hover:scale-105 shadow-md"
                        >
                            تأكيد التبديل
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">* سيتم تحديث جدول المباريات تلقائياً ليعكس هذا التبديل.</p>
                </div>

                {/* 📋 شبكة المجموعات (الكود الأصلي بتاعك) */}
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