import { useState, useEffect } from 'react';

export default function MediaHub() {
    const [mediaList, setMediaList] = useState([]);
    const [title, setTitle] = useState('');
    const [videoUrl, setVideoUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const isAdmin = !!localStorage.getItem('adminToken');

    const fetchMedia = async () => {
        try {
            const res = await fetch('/api/Media');
            const data = await res.json();
            setMediaList(Array.isArray(data) ? data : (data?.$values || []));
            setLoading(false);
        } catch (error) {
            console.error("Error fetching media:", error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMedia();
    }, []);

    const handleAddMedia = async (e) => {
        e.preventDefault();
        if (!title || !videoUrl) return alert("يرجى إدخال العنوان والرابط!");

        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch('/api/Media', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ title, videoUrl })
            });

            if (res.ok) {
                alert("تم إضافة الفيديو بنجاح! 🎥");
                setTitle('');
                setVideoUrl('');
                fetchMedia();
            } else {
                alert("حدث خطأ أثناء الإضافة.");
            }
        } catch (error) {
            alert("مشكلة في الاتصال بالسيرفر.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("هل أنت متأكد من حذف هذا الفيديو؟")) return;
        const token = localStorage.getItem('adminToken');
        try {
            const res = await fetch(`/api/Media/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert("تم الحذف بنجاح! 🗑️");
                fetchMedia();
            }
        } catch (error) {
            alert("مشكلة في الاتصال بالسيرفر.");
        }
    };

    // دالة لاستخراج ID اليوتيوب لعرضه مباشرة
    const getYouTubeEmbedUrl = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
    };

    if (loading) return <div className="text-center mt-10 font-bold text-xl">جاري تحميل الميديا... ⏳</div>;

    return (
        <div className="max-w-6xl mx-auto mt-8 px-4 pb-12" dir="rtl">
            <h2 className="text-3xl sm:text-4xl font-black text-center mb-8 text-gray-800 flex items-center justify-center gap-3">
                <span>🎥</span> مركز الميديا والملخصات
            </h2>

            {/* فورم إضافة ميديا جديدة (للأدمن فقط) */}
            {isAdmin && (
                <form onSubmit={handleAddMedia} className="bg-white p-6 rounded-xl shadow-md border border-red-100 mb-10 max-w-2xl mx-auto flex flex-col gap-4">
                    <h3 className="font-bold text-red-700">🎬 إضافة فيديو جديد:</h3>
                    <input 
                        type="text" placeholder="عنوان الفيديو (مثال: أهداف الافتتاح)..." 
                        value={title} onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 font-bold"
                    />
                    <input 
                        type="url" placeholder="رابط الفيديو (يوتيوب أو فيسبوك)..." 
                        value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)}
                        className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-left" dir="ltr"
                    />
                    <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-lg transition shadow-sm">
                        نشر الفيديو 🚀
                    </button>
                </form>
            )}

            {/* عرض الفيديوهات */}
            {mediaList.length === 0 ? (
                <p className="text-center text-gray-500 font-bold text-lg">لم يتم نشر أي فيديوهات حتى الآن ⏳</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {mediaList.map(media => {
                        const embedUrl = getYouTubeEmbedUrl(media.videoUrl || media.VideoUrl);
                        const mediaId = media.id || media.Id;
                        return (
                            <div key={mediaId} className="bg-white rounded-2xl shadow-md overflow-hidden flex flex-col border border-gray-100 hover:shadow-xl transition-shadow">
                                {/* منطقة عرض الفيديو */}
                                <div className="w-full h-56 bg-gray-900 flex items-center justify-center relative">
                                    {embedUrl ? (
                                        <iframe 
                                            src={embedUrl} title={media.title || media.Title}
                                            className="w-full h-full" allowFullScreen
                                        ></iframe>
                                    ) : (
                                        <div className="text-center p-4">
                                            <span className="text-5xl block mb-2">🔗</span>
                                            <a href={media.videoUrl || media.VideoUrl} target="_blank" rel="noopener noreferrer" className="bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-sm hover:bg-blue-700">
                                                مشاهدة على الموقع الخارجي
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {/* عنوان الفيديو وزرار الحذف */}
                                <div className="p-4 flex justify-between items-start gap-2 bg-white flex-1">
                                    <h3 className="font-black text-gray-800 text-lg leading-tight">
                                        {media.title || media.Title}
                                    </h3>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => handleDelete(mediaId)}
                                            className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition shrink-0" title="حذف الفيديو"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}