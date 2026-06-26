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

    // 1. دالة توليد المباريات
    const handleGenerate = async () => {
        const token = localStorage.getItem('adminToken');
        const res = await fetch('/api/Tournament/generate-schedule', {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        alert(data.message || data.Message);
        fetchDrafts();
    };

    // 2. دالة تغيير موعد المباراة
    const handleDateChange = async (matchId, newDate) => {
        const token = localStorage.getItem('adminToken');
        await fetch(`/api/Tournament/update-date/${matchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(newDate)
        });
        fetchDrafts();
    };

    // 3. دالة ترحيل جولة محددة (الجديدة 🚀)
    // 3. دالة ترحيل جولة محددة
    const handlePublishRound = async (roundKey) => {
    // 🔥 التعديل هنا: بنشيل parseInt تماماً لأن الباك إند بقا بيستقبل نص أو رقم
    // بنعمل encodeURIComponent عشان لو الاسم عربي وفيه مسافات (زي "ربع النهائي") يتبعت في الـ URL صح
    const roundIdentifier = roundKey === "غير محدد" ? "0" : encodeURIComponent(roundKey);

    // تغيير نص التأكيد ذكياً بناءً على نوع الدور
    const confirm = window.confirm(`هل أنت متأكد من ترحيل ونشر مباريات ${!isNaN(roundKey) ? `الجولة ${roundKey}` : roundKey} للجمهور؟`);
    if (!confirm) return;

    const token = localStorage.getItem('adminToken');
    try {
        // 🚀 بنبعت المعرّف الجديد (رقم أو نص متشفر)
        const res = await fetch(`/api/Tournament/publish-round/${roundIdentifier}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
            alert(`تم النشر بنجاح! 🚀`);
            fetchDrafts(); // إعادة جلب البيانات لتحديث الشاشة
        } else {
            alert(data.message || data.Message);
        }
    } catch (error) {
        alert("مشكلة في الاتصال بالسيرفر.");
    }
};

    if (!isAdmin) return null;

    // 🔥 تجميع المباريات في كائن (Object) بناءً على رقم الجولة
    const matchesByRound = drafts.reduce((acc, match) => {
    const matchType = match.matchType || match.MatchType;
    let roundKey;

    // لو الماتش في المجموعات، هات رقم الجولة
    if (matchType === "Group") {
        const roundVal = match.roundNumber ?? match.RoundNumber;
        roundKey = (roundVal && roundVal !== 0) ? roundVal : "غير محدد";
    } else {
        // لو الماتش في الإقصائيات، هات اسمه (زي "ربع النهائي")
        roundKey = matchType; 
    }
    
    if (!acc[roundKey]) acc[roundKey] = [];
    acc[roundKey].push(match);
    return acc;
}, {});

    return (
        <div className="max-w-4xl mx-auto mt-8 px-4 pb-12" dir="rtl">
            <h2 className="text-3xl font-black text-center mb-8 text-indigo-900">غرفة جدولة المباريات 🗓️ (سري)</h2>

            {drafts.length > 0 ? (
                <div className="space-y-8">
                    <h3 className="font-bold text-gray-700 text-center bg-yellow-100 py-2 rounded-lg border border-yellow-300">
                        ⚠️ قم بتعديل تواريخ المباريات لكل جولة ثم اضغط على "ترحيل الجولة" لتظهر للجمهور
                    </h3>

                    {/* 🔥 عرض الجولات مرتبة */}
                    {Object.keys(matchesByRound).sort((a, b) => a - b).map((roundKey) => {
                        const roundMatches = matchesByRound[roundKey];

                        return (
                            <div key={roundKey} className="bg-white rounded-xl shadow border border-indigo-100 overflow-hidden">
                                
                                {/* 🏆 شريط عنوان الجولة وزرار الترحيل */}
<div className="bg-indigo-900 text-white px-5 py-4 flex flex-wrap justify-between items-center gap-3">
    <h3 className="font-black text-lg flex items-center gap-2">
        {/* 👇 التعديل الذكي لعرض العنوان 👇 */}
        {!isNaN(roundKey) 
            ? `⚽ الجولة ${roundKey !== "غير محدد" ? `رقم ${roundKey}` : "غير المحددة"}` 
            : `🏆 ${roundKey}`
        }
        
        <span className="text-xs bg-indigo-700 text-yellow-300 px-2 py-1 rounded font-bold">
            {roundMatches.length} مباريات
        </span>
    </h3>
    
    <button
        onClick={() => handlePublishRound(roundKey)}
        className="bg-green-500 hover:bg-green-600 text-white text-sm font-black px-5 py-2 rounded-lg transition shadow-md flex items-center gap-2"
    >
        {/* زرار الترحيل برضه بيتغير بناءً على الجولة أو الدور */}
        🚀 ترحيل {!isNaN(roundKey) ? "هذه الجولة" : "هذا الدور"} للجمهور
    </button>
</div>

                                {/* 📋 لستة الماتشات الخاصة بالجولة دي بس */}
                                <div className="p-5 grid gap-4">
                                    {roundMatches.map(match => (
                                        <div key={match.id || match.Id} className="flex flex-col md:flex-row justify-between items-center bg-gray-50 hover:bg-indigo-50 transition p-4 rounded-lg border border-gray-200">
                                            
                                            <div className="flex justify-center items-center w-full md:w-1/2 mb-3 md:mb-0">
                                                <span className="font-black text-lg text-indigo-900 w-2/5 text-center truncate">{match.team1?.name || match.team1?.Name || match.Team1?.Name}</span>
                                                <span className="text-gray-400 font-bold px-2 w-1/5 text-center text-sm">ضد</span>
                                                <span className="font-black text-lg text-indigo-900 w-2/5 text-center truncate">{match.team2?.name || match.team2?.Name || match.Team2?.Name}</span>
                                            </div>
                                            
                                            <div className="w-full md:w-auto">
                                                <input 
                                                    type="datetime-local" 
                                                    value={match.matchDate ? match.matchDate.substring(0, 16) : ''} 
                                                    onChange={(e) => handleDateChange(match.id || match.Id, e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg p-2.5 text-sm font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                                                    dir="ltr"
                                                />
                                            </div>
                                            
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-10 text-center">
                    <p className="text-gray-500 font-bold text-lg">😎 لا توجد مباريات مسودة حالياً.</p>
                    <p className="text-gray-400 text-sm mt-2">كل الجولات تم ترحيلها أو لم يتم توليد الجدول بعد.</p>
                </div>
            )}
        </div>
    );
}