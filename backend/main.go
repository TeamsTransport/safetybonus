
// main.go
package main

import (
    "context"
    "database/sql"
    "log"
    "net/http"
    "os"
    "time"

    "github.com/gin-contrib/cors"
    "github.com/gin-gonic/gin"
    _ "github.com/go-sql-driver/mysql"
)

var db *sql.DB
var localTZ *time.Location

func mustLoadLocation() *time.Location {
    loc, err := time.LoadLocation("America/Winnipeg")
    if err != nil {
        log.Printf("WARN: failed loading America/Winnipeg, falling back to Local: %v", err)
        return time.Local
    }
    return loc
}

func main() {
    localTZ = mustLoadLocation()

    // DB bootstrap with retries
    dsn := os.Getenv("DB_DSN")
    if dsn == "" {
        log.Fatal("DB_DSN is required, e.g. safety_user:safety_password@tcp(db:3306)/driver_safety?parseTime=true")
    }
    var err error
    for i := 1; i <= 20; i++ {
        db, err = sql.Open("mysql", dsn)
        if err == nil {
            db.SetConnMaxLifetime(time.Minute * 3)
            db.SetMaxIdleConns(10)
            db.SetMaxOpenConns(100)
            ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
            err = db.PingContext(ctx)
            cancel()
            if err == nil {
                log.Println("Connected to database successfully")
                break
            }
        }
        log.Printf("DB connection attempt %d failed, retrying...", i)
        time.Sleep(2 * time.Second)
    }

    // Gin setup
    r := gin.New()
    r.Use(gin.Logger(), gin.Recovery())

    // UPDATED CORS: More permissive for development to resolve 403 OPTIONS errors
    r.Use(cors.New(cors.Config{
        AllowAllOrigins:  true, // Allows frontend from any local port
        AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
        AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With"},
        ExposeHeaders:    []string{"Content-Length", "Content-Type"},
        AllowCredentials: true,
        MaxAge:           12 * time.Hour,
    }))

    // Healthcheck
    r.GET("/api/healthz", func(c *gin.Context) {
        ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
        defer cancel()
        if err := db.PingContext(ctx); err != nil {
            c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unhealthy", "error": err.Error()})
            return
        }
        now := time.Now().In(localTZ)
        c.JSON(http.StatusOK, gin.H{"status": "ok", "time": now.Format(time.RFC3339)})
    })

    // Lightweight OpenAPI JSON + Swagger UI via CDN
    r.GET("/openapi.json", serveOpenAPI)
    r.GET("/swagger", serveSwaggerUI)

    // API routes
    api := r.Group("/api")
    {
        // Bootstrap
        api.GET("/bootstrap", bootstrap)

        // Drivers
        api.GET("/drivers", getDrivers)
        api.POST("/drivers", createDriver)
        api.PUT("/drivers/:id", updateDriver)
        api.DELETE("/drivers/:id", deleteDriver)
        api.GET("/drivers/:id/stats", getDriverStats)
        api.POST("/drivers/:id/assign-truck", assignDriverToTruckHandler)

        // Driver types
        api.GET("/driver-types", getDriverTypes)
        api.POST("/driver-types", createDriverType)
        api.PUT("/driver-types/:id", updateDriverType)
        api.DELETE("/driver-types/:id", deleteDriverType)

        // Trucks
        api.GET("/trucks", getTrucks)
        api.POST("/trucks", createTruck)
        api.PUT("/trucks/:id", updateTruck)
        api.DELETE("/trucks/:id", deleteTruck)
        api.GET("/trucks/:id/history", getTruckHistory)
        api.POST("/trucks/:id/assign-driver", assignTruckToDriver)

        // Safety categories
        api.GET("/safety-categories", getSafetyCategories)
        api.POST("/safety-categories", createSafetyCategory)
        api.PUT("/safety-categories/:id", updateSafetyCategory)
        api.DELETE("/safety-categories/:id", deleteSafetyCategory)

        // Scorecard metrics (items)
        api.GET("/scorecard-metrics", getScorecardMetrics)
        api.POST("/scorecard-metrics", createScorecardMetric)
        api.PUT("/scorecard-metrics/:id", updateScorecardMetric)
        api.DELETE("/scorecard-metrics/:id", deleteScorecardMetric)

        // Safety events
        api.GET("/safety-events", getSafetyEvents)
        api.POST("/safety-events", createSafetyEvent)
        api.PUT("/safety-events/:id", updateSafetyEvent)
        api.DELETE("/safety-events/:id", deleteSafetyEvent)

        // Scorecard events
        api.GET("/scorecard-events", getScoreCardEvents)
        api.POST("/scorecard-events", createScoreCardEvent)
        api.PUT("/scorecard-events/:id", updateScoreCardEvent)
        api.DELETE("/scorecard-events/:id", deleteScoreCardEvent)
        api.DELETE("/scorecard-events", deleteScoreCardEventsByFilter)
    }

    port := os.Getenv("API_PORT")
    if port == "" {
        port = "8080"
    }
    log.Printf("DriverSafetyBonus API listening on :%s (TZ=%s)", port, localTZ.String())
    if err := r.Run(":" + port); err != nil {
        log.Fatalf("server error: %v", err)
    }
}
