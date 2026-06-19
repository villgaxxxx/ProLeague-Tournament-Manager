using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FutsalApp.Data;

namespace FutsalApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class NotificationsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public NotificationsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetNotifications()
        {
            // جلب الإعلانات مترتبة من الأحدث للأقدم
            return Ok(await _context.Notifications.OrderByDescending(n => n.CreatedAt).ToListAsync());
        }
    }
}