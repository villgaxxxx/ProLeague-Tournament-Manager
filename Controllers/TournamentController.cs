using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FutsalApp.Data;
using FutsalApp.Models;
using Microsoft.AspNetCore.Authorization;

namespace FutsalApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TournamentController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TournamentController(AppDbContext context)
        {
            _context = context;
        }

        // 1. جلب إعدادات البطولة (وإنشائها لو مش موجودة)
        [HttpGet("settings")]
        public async Task<ActionResult<TournamentSetting>> GetSettings()
        {
            var settings = await _context.TournamentSettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                settings = new TournamentSetting();
                _context.TournamentSettings.Add(settings);
                await _context.SaveChangesAsync();
            }
            return Ok(settings);
        }

        // 2. تحديث إعدادات البطولة (للإدمن بس)
        [Authorize]
        [HttpPut("settings")]
        public async Task<IActionResult> UpdateSettings(TournamentSetting updatedSettings)
        {
            var settings = await _context.TournamentSettings.FirstOrDefaultAsync();
            if (settings == null) return NotFound();

            // ممنوع نعدل حجم المجموعة لو القرعة اتعملت خلاص
            if (settings.IsGroupStageDrawn && settings.GroupSize != updatedSettings.GroupSize)
            {
                return BadRequest(new { Message = "لا يمكن تغيير حجم المجموعة بعد سحب القرعة!" });
            }

            settings.IsHomeAway = updatedSettings.IsHomeAway;
            settings.GroupSize = updatedSettings.GroupSize;
            settings.EnableBestThirds = updatedSettings.EnableBestThirds;

            await _context.SaveChangesAsync();
            return Ok(new { Message = "تم حفظ إعدادات البطولة بنجاح ⚙️" });
        }

        // 3. سحب القرعة العشوائية وتوزيع المجموعات
        [Authorize]
        [HttpPost("draw-groups")]
        public async Task<IActionResult> DrawGroups()
        {
            var settings = await _context.TournamentSettings.FirstOrDefaultAsync();
            if (settings == null || settings.IsGroupStageDrawn)
                return BadRequest(new { Message = "القرعة اتسحبت بالفعل أو الإعدادات غير موجودة." });

            var teams = await _context.Teams.ToListAsync();
            if (teams.Count < settings.GroupSize)
                return BadRequest(new { Message = $"عدد الفرق المسجلة ({teams.Count}) أقل من حجم المجموعة المطلوب ({settings.GroupSize})!" });

            // خلط الفرق بشكل عشوائي (Shuffle)
            var random = new Random();
            var shuffledTeams = teams.OrderBy(t => random.Next()).ToList();

            // توزيع الفرق على مجموعات (A, B, C...)
            char currentGroupName = 'A';
            int count = 0;

            foreach (var team in shuffledTeams)
            {
                team.GroupName = currentGroupName.ToString();
                count++;

                // لما المجموعة تتملي، ننقل للحرف اللي بعده
                if (count % settings.GroupSize == 0 && count < shuffledTeams.Count)
                {
                    currentGroupName++;
                }
            }

            // قفل زرار القرعة
            settings.IsGroupStageDrawn = true;
            await _context.SaveChangesAsync();

            return Ok(new { Message = "تم سحب القرعة وتوزيع الفرق بنجاح! 🎲" });
        }

        // 4. عرض المجموعات بعد القرعة
        [HttpGet("groups")]
        public async Task<IActionResult> GetGroups()
        {
            var teams = await _context.Teams
                .Where(t => t.GroupName != null)
                .OrderBy(t => t.GroupName)
                .ToListAsync();

            // تجميع الفرق بناءً على اسم المجموعة
            var groupedTeams = teams.GroupBy(t => t.GroupName)
                                    .Select(g => new { GroupName = g.Key, Teams = g.ToList() })
                                    .ToList();

            return Ok(groupedTeams);        
        }

        // 5. إنشاء جدول المجموعات تلقائياً (مسودة سرية)
        [Authorize]
        [HttpPost("generate-schedule")]
        public async Task<IActionResult> GenerateSchedule()
        {
            var settings = await _context.TournamentSettings.FirstOrDefaultAsync();
            if (settings == null || !settings.IsGroupStageDrawn)
                return BadRequest(new { Message = "يجب سحب القرعة أولاً!" });

            // التأكد إن الجدول ماتعملش قبل كده
            bool hasMatches = await _context.Matches.AnyAsync(m => m.MatchType == "Group");
            if (hasMatches) return BadRequest(new { Message = "تم إنشاء جدول المجموعات مسبقاً." });

            var teams = await _context.Teams.Where(t => t.GroupName != null).ToListAsync();
            var groups = teams.GroupBy(t => t.GroupName);

            foreach (var group in groups)
            {
                var groupTeams = group.ToList();
                // خوارزمية الدوري (كل فريق يلاعب التاني)
                for (int i = 0; i < groupTeams.Count; i++)
                {
                    for (int j = i + 1; j < groupTeams.Count; j++)
                    {
                        // مباراة الذهاب
                        _context.Matches.Add(new Match
                        {
                            Team1Id = groupTeams[i].Id,
                            Team2Id = groupTeams[j].Id,
                            MatchType = "Group",
                            IsPublished = false, // سرية
                            MatchDate = DateTime.Now.AddDays(1) // موعد مبدئي
                        });

                        // لو الإدمن مفعل الذهاب والإياب
                        if (settings.IsHomeAway)
                        {
                            _context.Matches.Add(new Match
                            {
                                Team1Id = groupTeams[j].Id,
                                Team2Id = groupTeams[i].Id,
                                MatchType = "Group",
                                IsPublished = false,
                                MatchDate = DateTime.Now.AddDays(3) // موعد مبدئي للإياب
                            });
                        }
                    }
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { Message = "تم توليد جدول مباريات المجموعات بنجاح! 📅" });
        }

        // 6. جلب المسودات السرية للإدمن
        // 6. جلب المسودات السرية للإدمن
        [Authorize]
        [HttpGet("draft-matches")]
        public async Task<IActionResult> GetDraftMatches()
        {
            var drafts = await _context.Matches
                .Include(m => m.Team1)
                .Include(m => m.Team2)
                .Where(m => !m.IsPublished) // مسحنا شرط الـ Group عشان نعرض مسودات الإقصائيات كمان
                .ToListAsync();
            return Ok(drafts);
        }

        // 7. تحديث موعد مباراة في المسودة
        [Authorize]
        [HttpPut("update-date/{id}")]
        public async Task<IActionResult> UpdateMatchDate(int id, [FromBody] string newDate)
        {
            var match = await _context.Matches.FindAsync(id);
            if (match == null) return NotFound();

            match.MatchDate = DateTime.Parse(newDate);
            await _context.SaveChangesAsync();
            return Ok();
        }

        // 8. ترحيل ونشر المباريات للجمهور
        [Authorize]
        [HttpPut("publish-matches")]
        public async Task<IActionResult> PublishMatches()
        {
            var drafts = await _context.Matches.Where(m => !m.IsPublished).ToListAsync();
            foreach (var match in drafts) { match.IsPublished = true; }
            await _context.SaveChangesAsync();
            return Ok(new { Message = "تم ترحيل جميع المباريات للجمهور بنجاح! 🚀" });
        }

        // 9. جلب وترتيب أفضل ثوالث في البطولة بناءً على قواعد الفيفا واللعب النظيف
        [HttpGet("best-thirds")]
        public async Task<IActionResult> GetBestThirds()
        {
            // جلب كل الفرق المسجلة في مجموعات
            var teams = await _context.Teams.Where(t => t.GroupName != null).ToListAsync();
            var groups = teams.GroupBy(t => t.GroupName);

            var thirdPlacedTeams = new List<object>();

            foreach (var group in groups)
            {
                // ترتيب فرق المجموعة داخلياً لمعرفة مين المركز الثالث
                var sortedGroup = group.OrderByDescending(t => t.Points)
                                       .ThenByDescending(t => t.GoalsFor - t.GoalsAgainst)
                                       .ThenByDescending(t => t.GoalsFor)
                                       .ToList();

                // لو المجموعة فيها 3 فرق أو أكثر، ناخد الفريق صاحب المركز الثالث (Index 2)
                if (sortedGroup.Count >= 3)
                {
                    var thirdTeam = sortedGroup[2];

                    // حساب نقاط اللعب النظيف بناءً على كروت لاعبي هذا الفريق
                    var playerIds = await _context.Players.Where(p => p.TeamId == thirdTeam.Id).Select(p => p.Id).ToListAsync();
                    int yellowCards = await _context.Players.Where(p => playerIds.Contains(p.Id)).SumAsync(p => p.YellowCards);
                    int redCards = await _context.Players.Where(p => playerIds.Contains(p.Id)).SumAsync(p => p.RedCards);
                    int blueCards = await _context.Players.Where(p => playerIds.Contains(p.Id)).SumAsync(p => p.BlueCards);

                    // خصومات الفيفا للعب النظيف
                    int fairPlayPoints = (yellowCards * -1) + (redCards * -4) + (blueCards * -5);

                    thirdPlacedTeams.Add(new
                    {
                        TeamId = thirdTeam.Id,
                        TeamName = thirdTeam.Name,
                        GroupName = thirdTeam.GroupName,
                        Points = thirdTeam.Points,
                        Wins = thirdTeam.Wins,
                        Draws = thirdTeam.Draws,
                        Losses = thirdTeam.Losses,
                        GoalsFor = thirdTeam.GoalsFor,
                        GoalsAgainst = thirdTeam.GoalsAgainst,
                        GoalDifference = thirdTeam.GoalsFor - thirdTeam.GoalsAgainst,
                        FairPlayPoints = fairPlayPoints // كل ما كان الرقم أقرب للصفر كل ما كان أفضل
                    });
                }
            }

            // تطبيق ترتيب الفيفا النهائي على كل ثوالث المجموعات
            var sortedThirds = thirdPlacedTeams.Cast<dynamic>()
                .OrderByDescending(t => t.Points)
                .ThenByDescending(t => t.GoalDifference)
                .ThenByDescending(t => t.GoalsFor)
                .ThenByDescending(t => t.FairPlayPoints) // الأقل كروت يسبق
                .ToList();

            return Ok(sortedThirds);
        }

        // 10. توليد مباريات الأدوار الإقصائية (خروج المغلوب)
        // 10. توليد مباريات الأدوار الإقصائية (خروج المغلوب)
        [Authorize]
        [HttpPost("generate-knockouts")]
        public async Task<IActionResult> GenerateKnockouts()
        {
            var settings = await _context.TournamentSettings.FirstOrDefaultAsync();
            if (settings == null) return BadRequest(new { Message = "الإعدادات غير موجودة." });

            // 1. التأكد إن فيه ماتشات مجموعات أصلاً
            bool hasGroupMatches = await _context.Matches.AnyAsync(m => m.MatchType == "Group");
            if (!hasGroupMatches) return BadRequest(new { Message = "لا يوجد مباريات مسجلة لدور المجموعات أصلاً! ⚠️" });

            // 2. القفل الحديدي: التأكد إن كل ماتشات المجموعات انتهت
            bool hasUnfinishedMatches = await _context.Matches.AnyAsync(m => m.MatchType == "Group" && !m.IsFinished);
            if (hasUnfinishedMatches) return BadRequest(new { Message = "عفواً، يجب إنهاء جميع مباريات دور المجموعات أولاً قبل سحب قرعة الأدوار الإقصائية! 🛑" });

            // 3. التأكد إن القرعة دي ماتعملتش قبل كده
            bool hasKnockouts = await _context.Matches.AnyAsync(m => m.MatchType != "Group");
            if (hasKnockouts) return BadRequest(new { Message = "تم إنشاء مباريات الأدوار الإقصائية مسبقاً!" });

            var teams = await _context.Teams.Where(t => t.GroupName != null).ToListAsync();
            var groups = teams.GroupBy(t => t.GroupName);

            var qualifiedTeams = new List<Team>();
            var thirdPlacedTeams = new List<Team>();

            // استخراج المتأهلين (الأول والثاني، والاحتفاظ بالثالث مؤقتاً)
            foreach (var group in groups)
            {
                var sortedGroup = group.OrderByDescending(t => t.Points)
                                       .ThenByDescending(t => t.GoalsFor - t.GoalsAgainst)
                                       .ThenByDescending(t => t.GoalsFor).ToList();

                if (sortedGroup.Count > 0) qualifiedTeams.Add(sortedGroup[0]); // الأول
                if (sortedGroup.Count > 1) qualifiedTeams.Add(sortedGroup[1]); // الثاني
                if (sortedGroup.Count > 2) thirdPlacedTeams.Add(sortedGroup[2]); // الثالث
            }

            // تكميل العدد بأفضل ثوالث (لو الأوبشن متفعل)
            int targetCount = qualifiedTeams.Count <= 4 ? 4 : (qualifiedTeams.Count <= 8 ? 8 : 16);
            if (settings.EnableBestThirds && qualifiedTeams.Count < targetCount)
            {
                int needed = targetCount - qualifiedTeams.Count;

                // هنا بنطبق نفس لوجيك الفيفا (نقاط > فارق أهداف > أهداف له) عشان نختار أفضل ثوالث
                var bestThirds = thirdPlacedTeams.OrderByDescending(t => t.Points)
                                                 .ThenByDescending(t => t.GoalsFor - t.GoalsAgainst)
                                                 .ThenByDescending(t => t.GoalsFor)
                                                 .Take(needed).ToList();

                qualifiedTeams.AddRange(bestThirds);
            }

            // لو العدد طلع مش مناسب لعمل شجرة (مثلاً 5 أو 6 فرق ومش مكملين 8)
            if (qualifiedTeams.Count != 4 && qualifiedTeams.Count != 8 && qualifiedTeams.Count != 16)
                return BadRequest(new { Message = $"عدد الفرق المتأهلة ({qualifiedTeams.Count}) لا يصلح لعمل شجرة إقصائية. تأكد من إعدادات تأهيل الثوالث." });

            // ترتيب المتأهلين لعمل قرعة عادلة (Seeded Draw: الأقوى ضد الأضعف)
            var seededTeams = qualifiedTeams.OrderByDescending(t => t.Points)
                                            .ThenByDescending(t => t.GoalsFor - t.GoalsAgainst)
                                            .ThenByDescending(t => t.GoalsFor).ToList();

            int totalTeams = seededTeams.Count;
            string roundName = totalTeams == 8 ? "QuarterFinal" : (totalTeams == 4 ? "SemiFinal" : "Knockout");

            // إنشاء المباريات السرية للإقصائيات
            for (int i = 0; i < totalTeams / 2; i++)
            {
                _context.Matches.Add(new Match
                {
                    Team1Id = seededTeams[i].Id,
                    Team2Id = seededTeams[totalTeams - 1 - i].Id,
                    MatchType = roundName,
                    IsPublished = false, // مسودة سرية للإدمن
                    MatchDate = DateTime.Now.AddDays(7)
                });
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = $"تم سحب وتوليد مباريات ({roundName}) بنجاح! 🔥" });
        }
    }
}