namespace FutsalApp.Models
{
    public class TournamentSetting
    {
        public int Id { get; set; }
        public bool IsHomeAway { get; set; } = false; // ذهاب وإياب؟
        public int GroupSize { get; set; } = 4; // حجم المجموعة (3 أو 4)
        public bool EnableBestThirds { get; set; } = false; // تفعيل أفضل ثوالث؟
        public bool IsGroupStageDrawn { get; set; } = false; // هل تم سحب القرعة؟
    }
}