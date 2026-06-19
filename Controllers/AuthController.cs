using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FutsalApp.Models;

namespace FutsalApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AuthController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] LoginRequest request)
        {
            // التحقق من بيانات الإدمن (تقدر تغير الباسورد لأي حاجة تحبها)
            if (request.Username == "admin" && request.Password == "admin4422")
            {
                var token = GenerateJwtToken();
                return Ok(new { token });
            }

            return Unauthorized(new { message = "بيانات الدخول غير صحيحة" });
        }

        private string GenerateJwtToken()
        {
            // بنجيب المفتاح السري من ملف الإعدادات
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]!));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            // بنحدد شوية معلومات جوه التوكن زي اسم اليوزر وصلاحياته
            var claims = new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, "admin"),
                new Claim(ClaimTypes.Role, "Admin")
            };

            // بنصنع التوكن ونخليه يخلص بعد ساعتين من تسجيل الدخول
            var token = new JwtSecurityToken(
                issuer: _configuration["Jwt:Issuer"],
                audience: _configuration["Jwt:Audience"],
                claims: claims,
                expires: DateTime.Now.AddHours(2),
                signingCredentials: credentials);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}