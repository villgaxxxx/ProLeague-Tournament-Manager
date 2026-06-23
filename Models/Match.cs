using System.ComponentModel.DataAnnotations.Schema;

namespace FutsalApp.Models
{
    public class Match
    {
        public int Id { get; set; }

        [Column("team1_id")]
        public int Team1Id { get; set; }

        [Column("team2_id")]
        public int Team2Id { get; set; }

        [Column("match_date")]
        public DateTime MatchDate { get; set; }

        [Column("team1_score")]
        public int? Team1Score { get; set; }

        [Column("team2_score")]
        public int? Team2Score { get; set; }

        public string Status { get; set; } = "Scheduled";

        // ضفنا هنا خصائص حالة المباراة بس بدون تكرار التاريخ
        public bool IsPlaying { get; set; } = false;
        public bool IsFinished { get; set; } = false;
        public string? GroupName { get; set; } // اسم المجموعة (A, B, C)
        public int RoundNumber { get; set; }   // رقم الجولة

        [ForeignKey("Team1Id")]
        public virtual Team? Team1 { get; set; }

        [ForeignKey("Team2Id")]
        public virtual Team? Team2 { get; set; }
        public bool IsPostponed { get; set; } = false; // هل المباراة مؤجلة؟
        public string? PostponeReason { get; set; } // سبب التأجيل
        public string MatchType { get; set; } = "Group"; // نوع المباراة (مجموعات، ربع نهائي، الخ)
        public bool IsPublished { get; set; } = false; // هل تم نشر المباراة للجمهور؟
        public int? Team1PenaltiesScore { get; set; } // أهداف ضربات ترجيح الفريق الأول
        public int? Team2PenaltiesScore { get; set; } // أهداف ضربات ترجيح الفريق الثاني
        public string? MatchSummary { get; set; } // ملخص المباراة من الذكاء الاصطناعي 🤖
    }
}