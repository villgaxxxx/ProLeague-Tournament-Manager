import { useState, useEffect } from 'react';
import { toPng } from 'html-to-image';

export default function TopScorers() {
    const [scorers, setScorers] = useState([]);
    const [loading, setLoading] = useState(true);
    const isAdmin = !!localStorage.getItem('adminToken'); // للتحقق من الأدمن

    useEffect(() => {
        fetch('/api/Players/topscorers')
            .then(res => res.json())
            .then(data => {
                setScorers(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("مشكلة في الاتصال بالسيرفر:", err);
                setLoading(false);
            });
    }, []);

    // 📸 دالة التقاط قائمة الهدافين كصورة
    const handleDownloadScorersImage = async () => {
        const element = document.getElementById('scorers-capture');
        if (!element) return;

        try {
            // حفظ الستايل الأصلي للموبايل
            const originalBg = element.style.backgroundColor;
            const originalPadding = element.style.padding;
            const originalRadius = element.style.borderRadius;
            const originalWidth = element.style.width;
            const originalMaxWidth = element.style.maxWidth;

            // فرض مقاسات "كمبيوتر" مؤقتاً عشان الصورة تطلع عريضة وكاملة
            element.style.width = '800px'; 
            element.style.maxWidth = 'none';
            element.style.backgroundColor = '#f8fafc';
            element.style.padding = '30px';
            element.style.borderRadius = '16px';

            const dataUrl = await toPng(element, {
                quality: 1.0,
                pixelRatio: 2, // جودة عالية للصورة
                width: 800,
                style: { transform: 'scale(1)', transformOrigin: 'top left' },
                filter: (node) => {
                    if (node?.classList?.contains('hide-in-screenshot')) return false;
                    return true;
                }
            });

            // إرجاع الشكل الطبيعي فوراً
            element.style.width = originalWidth;
            element.style.maxWidth = originalMaxWidth;
            element.style.backgroundColor = originalBg;
            element.style.padding = originalPadding;
            element.style.borderRadius = originalRadius;

            // تنزيل الصورة
            const link = document.createElement('a');
            link.download = `قائمة-هدافي-البطولة.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("حدث خطأ أثناء التقاط الصورة:", error);
            alert("حدث خطأ أثناء تجهيز الصورة، يرجى المحاولة مرة أخرى.");
        }
    };

    if (loading) return <div className="text-center mt-10 font-bold text-xl text-gray-700">جاري تحميل القائمة... ⏳</div>;

    return (
        <div className="max-w-3xl mx-auto mt-8 mb-16 px-4" dir="rtl">
            
            {/* 🔥 زرار التصوير للأدمن فقط */}
            {isAdmin && scorers.length > 0 && (
                <div className="flex justify-end mb-4 px-2">
                    <button 
                        onClick={handleDownloadScorersImage}
                        className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-orange-500 text-white px-5 py-2 rounded-xl font-bold hover:shadow-lg transition transform hover:-translate-y-1 text-sm border-2 border-red-200"
                    >
                        <span>📸</span> تحميل قائمة الهدافين
                    </button>
                </div>
            )}

            {/* 🔥 المنطقة التي سيتم تصويرها تبدأ من هنا */}
            <div id="scorers-capture" className="bg-white rounded-lg shadow-lg p-6 relative">
                
                <h2 className="text-3xl font-black text-center mb-8 text-gray-800 flex items-center justify-center gap-2">
                    <span>🏆</span> قائمة الهدافين <span>⚽</span>
                </h2>
                
                {scorers.length === 0 ? (
                    <p className="text-center text-gray-500 font-bold text-lg p-6">لسه مفيش أهداف اتسجلت في البطولة!</p>
                ) : (
                    <div className="overflow-x-auto rounded-lg">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-blue-900 text-white border-b-4 border-blue-950">
                                    <th className="p-4 font-black">الترتيب</th>
                                    <th className="p-4 font-black">اسم اللاعب</th>
                                    <th className="p-4 font-black">الفريق</th>
                                    <th className="p-4 font-black">الأهداف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {scorers.map((player, index) => (
                                    <tr 
                                        key={player.playerId} 
                                        className={`transition duration-200 border-b border-gray-100 ${index === 0 ? "bg-amber-50 font-black text-amber-900 border-l-4 border-r-4 border-amber-500" : index % 2 === 0 ? "bg-gray-50" : "bg-white"} hover:bg-blue-50`}
                                    >
                                        <td className="p-4 text-lg">
                                            {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                        </td>
                                        <td className="p-4 text-lg text-gray-800">
                                            {player.playerName}
                                        </td>
                                        <td className="p-4 font-bold text-gray-600">
                                            {player.teamName}
                                        </td>
                                        <td className="p-4 text-3xl font-black text-blue-700">
                                            {player.goals}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        
                        {/* ووتر مارك صغيرة تظهر في نهاية الصورة */}
                        <div className="text-center mt-6 text-gray-400 font-bold text-xs opacity-80 pb-2">
                            سباق الحذاء الذهبي - تم الإنشاء بواسطة نظام إدارة البطولة 🥇
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}