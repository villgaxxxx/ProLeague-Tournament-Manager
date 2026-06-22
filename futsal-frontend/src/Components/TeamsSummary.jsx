import React, { useEffect, useState } from 'react';

const TeamsSummary = () => {
    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const token = localStorage.getItem('adminToken');
                const response = await fetch('https://proleague-api.somee.com/api/Teams/print-summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSummaryData(data);
                }
            } catch (error) {
                console.error("Error fetching summary:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    } , []);

    // 🖨️ دالة الطباعة الورقية المباشرة
    const handlePrint = () => {
        window.print();
    };

    // 📊 دالة تصدير البيانات لملف Excel (بدون مكتبات خارجية معقدة)
    const exportToExcel = () => {
        let html = `
            <meta charset="utf-8">
            <table border="1">
                <tr style="background-color: #4F46E5; color: white; font-weight: bold;">
                    <th>اسم الفريق</th>
                    <th>المجموعة</th>
                    <th>اسم الكابتن</th>
                    <th>رقم الهاتف</th>
                    <th>أسماء اللاعبين</th>
                </tr>
        `;

        summaryData.forEach(team => {
            html += `
                <tr>
                    <td>${team.teamName}</td>
                    <td>${team.groupName || 'غير محدد'}</td>
                    <td>${team.captainName || 'لا يوجد'}</td>
                    <td>${team.captainPhone || 'لا يوجد'}</td>
                    <td>${team.players.join(' - ')}</td>
                </tr>
            `;
        });

        html += '</table>';

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'كشف_فرق_البطولة.xls';
        a.click();
    };

    if (loading) return <div className="text-center p-10 font-bold">جاري تحميل البيانات...</div>;

    return (
        <div className="p-6 dir-rtl" style={{ direction: 'rtl' }}>
            {/* أزرار التحكم - تختفي تلقائياً عند الطباعة بفضل كلاس print:hidden */}
            <div className="flex gap-4 mb-6 print:hidden">
                <button 
                    onClick={handlePrint} 
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-lg shadow"
                >
                    طباعة الكشف ورقي 🖨️
                </button>
                <button 
                    onClick={exportToExcel} 
                    className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-2 rounded-lg shadow"
                >
                    تصدير إلى Excel 📊
                </button>
            </div>

            {/* عنوان الكشف الصالح للطباعة */}
            <h2 className="text-2xl font-black text-center mb-6 text-gray-800">كشف أسماء الفرق واللاعبين الإجمالي</h2>

            {/* الجدول الرئيسي */}
            <div className="overflow-x-auto border rounded-xl shadow-sm">
                <table className="w-full text-right border-collapse bg-white">
                    <thead>
                        <tr className="bg-gray-100 border-b border-gray-200">
                            <th className="p-4 font-bold text-gray-700 border-l">اسم الفريق</th>
                            <th className="p-4 font-bold text-gray-700 border-l">المجموعة</th>
                            <th className="p-4 font-bold text-gray-700 border-l">اسم الكابتن</th>
                            <th className="p-4 font-bold text-gray-700 border-l">رقم الهاتف</th>
                            <th className="p-4 font-bold text-gray-700">أسماء اللاعبين</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaryData.map((team, index) => (
                            <tr key={index} className="border-b hover:bg-gray-50 transition">
                                <td className="p-4 font-bold text-indigo-600 border-l">{team.teamName}</td>
                                <td className="p-4 text-gray-600 border-l">{team.groupName || '-'}</td>
                                <td className="p-4 text-gray-800 font-medium border-l">{team.captainName || '-'}</td>
                                <td className="p-4 text-gray-600 border-l style={{ direction: 'ltr' }} text-right">{team.captainPhone || '-'}</td>
                                <td className="p-4 text-gray-700 text-sm leading-relaxed">
                                    <div className="flex flex-wrap gap-x-2 gap-y-1">
                                        {team.players.map((player, pIdx) => (
                                            <span key={pIdx} className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                                {player}{pIdx < team.players.length - 1 ? '،' : ''}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TeamsSummary;