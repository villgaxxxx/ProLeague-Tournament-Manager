using FutsalApp.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using FutsalApp.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. إضافة الخدمات الأساسية للـ Controllers والـ Swagger
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    // إضافة زرار القفل في واجهة Swagger
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "اكتب كلمة Bearer بعدها مسافة وبعدين التوكن بتاعك \n\nمثال: Bearer eyJhbGci..."
    });

    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

// 2. إعداد الـ CORS (عشان يقبل الطلبات من React من أي بورت)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVercel",
        policy => policy
            .WithOrigins("https://pro-league-tournament-manager.vercel.app") // رابط الفرونت إند بتاعك
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()); // السطر ده مهم جدااااً للـ SignalR
});

// 3. تسجيل الـ AppDbContext في قائمة الخدمات (ده السطر اللي كان ناقص وعمل المشكلة!)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrEmpty(connectionString))
{
    throw new InvalidOperationException("رابط الاتصال بقاعدة البيانات غير موجود في ملف appsettings.json");
}

// تأكد إنك ضايف فوق: using Microsoft.EntityFrameworkCore;

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// إعدادات الـ JWT للحماية
var jwtKey = builder.Configuration["Jwt:Key"];
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
    };
});

// ==========================================
// أي AddServices لازم تكون فوق السطر ده
var app = builder.Build();
// ==========================================

// 4. إعدادات بيئة التشغيل
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll"); // لازم تكون هنا قبل الـ Authorization
app.UseAuthentication(); // لازم يكون ده قبل الـ Authorization
app.UseAuthorization();
app.UseCors("AllowVercel");
app.MapControllers();
app.Run();