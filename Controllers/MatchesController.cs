using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FutsalApp.Data;
using FutsalApp.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR; // 👈 مكتبة SignalR للبث المباشر
using FutsalApp.Hubs;              // 👈 مسار الـ MatchHub
using System.Text;

namespace FutsalApp.Controllers
{
    // كلاس استقبال نتيجة ضربات الترجيح
    public class PenaltyDto
    {
        public int Team1Penalties { get; set; }
        public int Team2Penalties { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class MatchesController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IHubContext<MatchHub> _hubContext; // 👈 متغير الـ Hub للبث
        private readonly IConfiguration _configuration;

        public MatchesController(AppDbContext context, IHubContext<MatchHub> hubContext, IConfiguration configuration)
        {
            _context = context;
            _hubContext = hubContext;
            _configuration = configuration;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Match>>> GetMatches()
        {
            return await _context.Matches
                .Include(m => m.Team1).ThenInclude(t => t.Players)
                .Include(m => m.Team2).ThenInclude(t => t.Players)
                .Where(m => m.IsPublished)
                .ToListAsync();
        }

        [HttpGet("results")]
        public async Task<IActionResult> GetMatchResults()
        {
            var results = await _context.Matches.Where(m => m.IsFinished)
                .Join(_context.Teams, m => m.Team1Id, t => t.Id, (m, t1) => new { m, t1 })
                .Join(_context.Teams, combined => combined.m.Team2Id, t => t.Id, (combined, t2) => new
                {
                    MatchId = combined.m.Id,
                    Team1Name = combined.t1.Name,
                    Team2Name = t2.Name,
                    Team1Score = combined.m.Team1Score,
                    Team2Score = combined.m.Team2Score,
                    MatchDate = combined.m.MatchDate
                }).OrderByDescending(m => m.MatchDate).ToListAsync();
            return Ok(results);
        }

        [Authorize]
        [HttpPost]
        public async Task<ActionResult<Match>> CreateMatch(Match newMatch)
        {
            newMatch.IsPublished = true;
            _context.Matches.Add(newMatch);
            await _context.SaveChangesAsync();
            return Ok(newMatch);
        }

        [Authorize]
        [HttpPut("{id}/start")]
        public async Task<IActionResult> StartMatch(int id)
        {
            var match = await _context.Matches.FindAsync(id);
            if (match == null) return NotFound();

            match.IsPlaying = true; match.IsFinished = false; match.IsPostponed = false;
            match.Team1Score = 0; match.Team2Score = 0;
            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize]
        [HttpPut("{id}/postpone")]
        public async Task<IActionResult> PostponeMatch(int id, [FromBody] string reason)
        {
            var match = await _context.Matches.FindAsync(id);
            if (match == null) return NotFound();
            match.IsPostponed = true; match.PostponeReason = reason;
            await _context.SaveChangesAsync();
            return Ok();
        }

        // 🔥 الدالة الموحدة والشاملة لكل أكشن لاعب (أهداف وكروت) 🔥
        [Authorize]
        [HttpPut("{matchId}/{actionType}/{playerId}")]
        public async Task<IActionResult> ActionPlayer(int matchId, string actionType, int playerId)
        {
            // 1. جلب المباراة واللاعب (مع تضمين الفريق عشان لوحة الإشعارات)
            var match = await _context.Matches.FindAsync(matchId);
            if (match == null || !match.IsPlaying) return BadRequest(new { Message = "المباراة غير موجودة أو ليست جارية حالياً." });

            var player = await _context.Players.Include(p => p.Team).FirstOrDefaultAsync(p => p.Id == playerId);
            if (player == null) return NotFound(new { Message = "اللاعب غير موجود." });

            string teamName = player.Team != null ? player.Team.Name : "فريق غير معروف";

            // 2. معالجة الأكشن بناءً على الـ Model الحديث بتاعك بالمللي
            switch (actionType.ToLower())
            {
                case "player-goal":
                    player.Goals++;
                    // تحديث نتيجة الماتش الفورية للفريق الصحيح
                    if (match.Team1Id == player.TeamId) match.Team1Score = (match.Team1Score ?? 0) + 1;
                    else if (match.Team2Id == player.TeamId) match.Team2Score = (match.Team2Score ?? 0) + 1;
                    break;

                case "remove-goal":
                    if (player.Goals > 0) player.Goals--;
                    // خصم الهدف من نتيجة الماتش الفورية
                    if (match.Team1Id == player.TeamId && (match.Team1Score ?? 0) > 0) match.Team1Score--;
                    else if (match.Team2Id == player.TeamId && (match.Team2Score ?? 0) > 0) match.Team2Score--;
                    break;

                case "yellow-card":
                    player.YellowCards++;
                    player.YellowCardsThisMatch++;

                    // قانون كرة الصالات وخماسي: لو خد إنذارين في نفس الماتش يتحولوا لطرد تلقائي
                    if (player.YellowCardsThisMatch == 2)
                    {
                        player.RedCards++; // يتسجل كارت أحمر تراكمي في الأرشيف
                        player.IsSuspended = true;
                        player.SuspendedThisMatch = true;
                        player.SuspendedMatchesLeft += 1; // إيقاف مباراة واحدة
                        _context.Notifications.Add(new Notification { Message = $"🟥 طرد (إنذارين): اللاعب ({player.Name}) من فريق ({teamName})." });
                    }
                    break;

                case "red-card":
                    player.RedCards++;
                    player.IsSuspended = true;
                    player.SuspendedThisMatch = true;
                    player.SuspendedMatchesLeft += 1; // طرد مباشر = إيقاف مباراة واحدة
                    _context.Notifications.Add(new Notification { Message = $"🛑 طرد مباشر: اللاعب ({player.Name}) من فريق ({teamName})." });
                    break;

                case "blue-card":
                    player.BlueCards++;
                    player.IsSuspended = true;
                    player.SuspendedThisMatch = true;
                    player.SuspendedMatchesLeft += 2; // طرد أخلاقي = إيقاف مباراتين في الأرشيف
                    _context.Notifications.Add(new Notification { Message = $"🟦 طرد أخلاقي: اللاعب ({player.Name}) من فريق ({teamName}) (إيقاف مباراتين)." });
                    break;

                default:
                    return BadRequest(new { Message = "إجراء غير مدعوم." });
            }

            // 3. حفظ التعديلات في الداتا بيز والبث الفوري للشاشات لايف ⚡
            await _context.SaveChangesAsync();
            return Ok(new { Message = "تم تحديث البيانات بنجاح." });
        }

        // --- 1. إنهاء مباراة عادية أو إقصائية بدون تعادل ---
        [Authorize]
        [HttpPut("{id}/finish")]
        public async Task<IActionResult> FinishLiveMatch(int id)
        {
            var match = await _context.Matches.FindAsync(id);
            if (match == null || !match.IsPlaying) return BadRequest();

            var team1 = await _context.Teams.Include(t => t.Players).FirstOrDefaultAsync(t => t.Id == match.Team1Id);
            var team2 = await _context.Teams.Include(t => t.Players).FirstOrDefaultAsync(t => t.Id == match.Team2Id);

            match.IsPlaying = false; match.IsFinished = true;

            // إدارة الإيقافات وتصفير عدادات الماتش الحالي (مستدعاة من الدالة المساعدة بالأسفل)
            ManageSuspensions(team1!.Players.Concat(team2!.Players).ToList());

            int s1 = match.Team1Score ?? 0; int s2 = match.Team2Score ?? 0;
            team1.GoalsFor += s1; team1.GoalsAgainst += s2; team2.GoalsFor += s2; team2.GoalsAgainst += s1;

            if (s1 > s2) { team1.Points += 3; team1.Wins += 1; team2.Losses += 1; }
            else if (s2 > s1) { team2.Points += 3; team2.Wins += 1; team1.Losses += 1; }
            else { team1.Points += 1; team2.Points += 1; team1.Draws += 1; team2.Draws += 1; }

            match.MatchSummary = await GenerateAISummary(team1!.Name, team2!.Name, s1, s2);
            await _context.SaveChangesAsync();
            if (match.MatchType == "Group") await AutoGenerateKnockouts();
            else await AutoGenerateNextRound(match.MatchType);

            if (match.MatchType == "Final")
            {
                int winnerId = GetWinnerId(match);
                var winnerTeam = await _context.Teams.FindAsync(winnerId);

                _context.Notifications.Add(new Notification
                {
                    Message = $"👑👑 ألف مبروك! رسمياً فريق ({winnerTeam?.Name}) يتوج بطلاً للبطولة بعد مباراة نهائية ملحمية! 🏆🎉"
                });
                await _context.SaveChangesAsync();
                return Ok(new { Message = "تم إنهاء المباراة النهائية! 🏆", ChampionName = winnerTeam?.Name });
            }
            return Ok(new { Message = "تم إنهاء المباراة بنجاح! 🛑" });
        }

        // --- 2. إنهاء مباراة إقصائية بضربات الترجيح ---
        [Authorize]
        [HttpPut("{id}/finish-knockout")]
        public async Task<IActionResult> FinishKnockoutMatch(int id, [FromBody] PenaltyDto penalties)
        {
            var match = await _context.Matches.FindAsync(id);
            if (match == null || !match.IsPlaying) return BadRequest();

            var team1 = await _context.Teams.Include(t => t.Players).FirstOrDefaultAsync(t => t.Id == match.Team1Id);
            var team2 = await _context.Teams.Include(t => t.Players).FirstOrDefaultAsync(t => t.Id == match.Team2Id);

            match.IsPlaying = false; match.IsFinished = true;
            match.Team1PenaltiesScore = penalties.Team1Penalties;
            match.Team2PenaltiesScore = penalties.Team2Penalties;

            ManageSuspensions(team1!.Players.Concat(team2!.Players).ToList());

            int s1 = match.Team1Score ?? 0; int s2 = match.Team2Score ?? 0;
            team1.GoalsFor += s1; team1.GoalsAgainst += s2; team2.GoalsFor += s2; team2.GoalsAgainst += s1;

            if (penalties.Team1Penalties > penalties.Team2Penalties) { team1.Wins += 1; team2.Losses += 1; }
            else { team2.Wins += 1; team1.Losses += 1; }

            match.MatchSummary = await GenerateAISummary(team1!.Name, team2!.Name, s1, s2, true, penalties.Team1Penalties, penalties.Team2Penalties);
            await _context.SaveChangesAsync();
            await AutoGenerateNextRound(match.MatchType);

            if (match.MatchType == "Final")
            {
                int winnerId = GetWinnerId(match);
                var winnerTeam = await _context.Teams.FindAsync(winnerId);

                _context.Notifications.Add(new Notification
                {
                    Message = $"👑👑 بضربات الترجيح الدراماتيكية.. فريق ({winnerTeam?.Name}) يتوج بطلاً للبطولة! 🏆🎉"
                });
                await _context.SaveChangesAsync();
                return Ok(new { Message = "تم حسم النهائي والتتويج! 🏆", ChampionName = winnerTeam?.Name });
            }
            return Ok(new { Message = "تم حسم المباراة بضربات الترجيح! 🥅" });
        }

        // --- دوال مساعدة مخفية (Private) ---
        private void ManageSuspensions(List<Player> players)
        {
            foreach (var p in players)
            {
                // تصفير عداد الماتش الحالي لتبدأ الصفحة نظيفة في الماتشات القادمة
                p.YellowCardsThisMatch = 0;
                if (p.IsSuspended)
                {
                    if (!p.SuspendedThisMatch)
                    {
                        p.SuspendedMatchesLeft -= 1;
                        if (p.SuspendedMatchesLeft <= 0) { p.IsSuspended = false; p.SuspendedMatchesLeft = 0; }
                    }
                    else p.SuspendedThisMatch = false; // فك تفعيل علم الطرد للماتش الحالي لأنه انتهى
                }
                else if (p.SuspendedThisMatch) { p.IsSuspended = true; p.SuspendedThisMatch = false; }
            }
        }

        private async Task AutoGenerateKnockouts()
        {
            bool allGroupsFinished = !await _context.Matches.AnyAsync(m => m.MatchType == "Group" && !m.IsFinished);
            bool knockoutsExist = await _context.Matches.AnyAsync(m => m.MatchType != "Group");
            if (!allGroupsFinished || knockoutsExist) return;

            var settings = await _context.TournamentSettings.FirstOrDefaultAsync();
            var teams = await _context.Teams.Where(t => t.GroupName != null).ToListAsync();
            var groups = teams.GroupBy(t => t.GroupName);

            var qualified = new List<Team>(); var thirds = new List<Team>();
            foreach (var g in groups)
            {
                var s = g.OrderByDescending(t => t.Points).ThenByDescending(t => t.GoalsFor - t.GoalsAgainst).ThenByDescending(t => t.GoalsFor).ToList();
                if (s.Count > 0) qualified.Add(s[0]);
                if (s.Count > 1) qualified.Add(s[1]);
                if (s.Count > 2) thirds.Add(s[2]);
            }

            int targetCount = qualified.Count <= 4 ? 4 : (qualified.Count <= 8 ? 8 : 16);
            if (settings != null && settings.EnableBestThirds && qualified.Count < targetCount)
            {
                int needed = targetCount - qualified.Count;
                qualified.AddRange(thirds.OrderByDescending(t => t.Points).ThenByDescending(t => t.GoalsFor - t.GoalsAgainst).ThenByDescending(t => t.GoalsFor).Take(needed));
            }
            if (qualified.Count != 4 && qualified.Count != 8 && qualified.Count != 16) return;

            var seeded = qualified.OrderByDescending(t => t.Points).ThenByDescending(t => t.GoalsFor - t.GoalsAgainst).ThenByDescending(t => t.GoalsFor).ToList();
            int total = seeded.Count;
            string round = total == 8 ? "QuarterFinal" : (total == 4 ? "SemiFinal" : "Knockout");

            for (int i = 0; i < total / 2; i++)
            {
                _context.Matches.Add(new Match { Team1Id = seeded[i].Id, Team2Id = seeded[total - 1 - i].Id, MatchType = round, IsPublished = false, MatchDate = DateTime.Now.AddDays(7) });
            }
            await _context.SaveChangesAsync();
        }

        private async Task AutoGenerateNextRound(string currentRound)
        {
            bool allCurrentFinished = !await _context.Matches.AnyAsync(m => m.MatchType == currentRound && !m.IsFinished);
            if (!allCurrentFinished) return;

            string nextRound = currentRound == "QuarterFinal" ? "SemiFinal" : (currentRound == "SemiFinal" ? "Final" : "");
            if (string.IsNullOrEmpty(nextRound) || await _context.Matches.AnyAsync(m => m.MatchType == nextRound)) return;

            var matches = await _context.Matches.Where(m => m.MatchType == currentRound).OrderBy(m => m.Id).ToListAsync();
            for (int i = 0; i < matches.Count; i += 2)
            {
                if (i + 1 >= matches.Count) break;
                int w1 = GetWinnerId(matches[i]);
                int w2 = GetWinnerId(matches[i + 1]);
                if (w1 != 0 && w2 != 0)
                {
                    _context.Matches.Add(new Match { Team1Id = w1, Team2Id = w2, MatchType = nextRound, IsPublished = false, MatchDate = DateTime.Now.AddDays(3) });
                }
            }
            await _context.SaveChangesAsync();
        }

        private int GetWinnerId(Match m)
        {
            int s1 = m.Team1Score ?? 0; int s2 = m.Team2Score ?? 0;
            if (s1 > s2) return m.Team1Id; if (s2 > s1) return m.Team2Id;
            int p1 = m.Team1PenaltiesScore ?? 0; int p2 = m.Team2PenaltiesScore ?? 0;
            if (p1 > p2) return m.Team1Id; if (p2 > p1) return m.Team2Id;
            return 0;
        }

        private async Task<string> GenerateAISummary(string t1Name, string t2Name, int t1Score, int t2Score, bool isPenalties = false, int p1 = 0, int p2 = 0)
        {
            try
            {
                string apiKey = _configuration["Gemini:ApiKey"];
                if (string.IsNullOrEmpty(apiKey)) return "مباراة مثيرة انتهت بأحداث حماسية!";

                string url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={apiKey}";
                string prompt = isPenalties
                    ? $"اكتب مانشيت صحفي رياضي حماسي قصير جداً (سطر واحد فقط) باللغة العربية عن مباراة كرة قدم انتهت بالتعادل {t1Score}-{t2Score} وفاز فيها فريق {t1Name} على {t2Name} بضربات الترجيح {p1} مقابل {p2}."
                    : $"اكتب مانشيت صحفي رياضي حماسي قصير جداً (سطر واحد فقط) باللغة العربية عن مباراة كرة قدم فاز فيها فريق {(t1Score > t2Score ? t1Name : t2Name)} على الآخر بنتيجة {t1Score}-{t2Score} بين {t1Name} و {t2Name}.";

                if (t1Score == t2Score && !isPenalties)
                    prompt = $"اكتب مانشيت صحفي رياضي حماسي قصير جداً (سطر واحد فقط) باللغة العربية عن مباراة كرة قدم انتهت بالتعادل المثير {t1Score}-{t2Score} بين {t1Name} و {t2Name}.";

                using var client = new HttpClient();
                client.DefaultRequestHeaders.Add("User-Agent", "ProLeagueTournamentManagerApp");

                var requestBody = new { contents = new[] { new { parts = new[] { new { text = prompt } } } } };
                var jsonContent = new StringContent(System.Text.Json.JsonSerializer.Serialize(requestBody), Encoding.UTF8, "application/json");
                var response = await client.PostAsync(url, jsonContent);

                if (response.IsSuccessStatusCode)
                {
                    var responseString = await response.Content.ReadAsStringAsync();
                    using var jsonDoc = System.Text.Json.JsonDocument.Parse(responseString);
                    var summary = jsonDoc.RootElement.GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
                    return summary?.Replace("\n", "").Trim() ?? "مباراة مثيرة انتهت بأحداث حماسية!";
                }
                return "مباراة مثيرة انتهت بأحداث حماسية!";
            }
            catch
            {
                return "مباراة مثيرة انتهت بأحداث حماسية!";
            }
        }
    }
}