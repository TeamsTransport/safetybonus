// handlers.go
package main

import (
    "context"
    "database/sql"
    "fmt"
    "log"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/gin-gonic/gin"
)

const (
    dateOnlyLayout = "2006-01-02"
)

// --- helpers ---

func atoi(s string) int {
    i, _ := strconv.Atoi(s)
    return i
}

func parseLocalDate(s string) (time.Time, error) {
    return time.ParseInLocation(dateOnlyLayout, s, localTZ)
}

func formatLocalDate(t time.Time) string {
    return t.In(localTZ).Format(dateOnlyLayout)
}

func queryRows(ctx context.Context, q string, args ...any) (*sql.Rows, error) {
    return db.QueryContext(ctx, q, args...)
}

func exec(ctx context.Context, q string, args ...any) (sql.Result, error) {
    return db.ExecContext(ctx, q, args...)
}

// --- Bootstrap ---

func bootstrap(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    var (
        trucks           []Truck
        driverTypes      []DriverType
        drivers          []Driver
        safetyCategories []SafetyCategory
        scoreCard        []ScoreCardItem
        safetyEvents     []SafetyEvent
        scoreCardEvents  []ScoreCardEvent
    )

    // Trucks
    rows, err := queryRows(ctx, `SELECT truck_id, unit_number, year, status FROM trucks`)
    if err != nil {
        log.Printf("Bootstrap error (trucks): %v", err)
        c.JSON(http.StatusInternalServerError, APIError{Message: "failed to fetch trucks data"})
        return
    }
    defer rows.Close()
    for rows.Next() {
        var t Truck
        if err := rows.Scan(&t.TruckID, &t.UnitNumber, &t.Year, &t.Status); err == nil {
            trucks = append(trucks, t)
        }
    }
    rows.Close()

    // Driver types
    rows, err = queryRows(ctx, `SELECT driver_type_id, driver_type FROM driver_type`)
    if err != nil {
        log.Printf("Bootstrap error (driver_types): %v", err)
        c.JSON(http.StatusInternalServerError, APIError{Message: "failed to fetch driver types data"})
        return
    }
    defer rows.Close()
    for rows.Next() {
        var dt DriverType
        if err := rows.Scan(&dt.DriverTypeID, &dt.DriverType); err == nil {
            driverTypes = append(driverTypes, dt)
        }
    }
    rows.Close()

    // Drivers
    rows, err = queryRows(ctx, `SELECT driver_id, driver_code, first_name, last_name, start_date, truck_id, driver_type_id, profile_pic FROM drivers`)
    if err != nil {
        log.Printf("Bootstrap error (drivers): %v", err)
        c.JSON(http.StatusInternalServerError, APIError{Message: "failed to fetch drivers data"})
        return
    }
    defer rows.Close()
    for rows.Next() {
        var (
            d                 Driver
            startDateNullable sql.NullTime
            truckIDNullable   sql.NullInt64
            typeIDNullable    sql.NullInt64
            picNullable       sql.NullString
        )
        if err := rows.Scan(&d.DriverID, &d.DriverCode, &d.FirstName, &d.LastName, &startDateNullable, &truckIDNullable, &typeIDNullable, &picNullable); err == nil {
            if startDateNullable.Valid {
                d.StartDate = formatLocalDate(startDateNullable.Time)
            }
            if truckIDNullable.Valid {
                val := int(truckIDNullable.Int64)
                d.TruckID = &val
            }
            if typeIDNullable.Valid {
                val := int(typeIDNullable.Int64)
                d.DriverTypeID = &val
            }
            if picNullable.Valid {
                val := picNullable.String
                d.ProfilePic = &val
            }
            drivers = append(drivers, d)
        }
    }
    rows.Close()

    // Safety categories
    rows, err = queryRows(ctx, `SELECT category_id, code, description, scoring_system, p_i_score FROM safety_categories`)
    if err != nil {
        log.Printf("Bootstrap error (safety_categories): %v", err)
        c.JSON(http.StatusInternalServerError, APIError{Message: "failed to fetch safety categories data"})
        return
    }
    defer rows.Close()
    for rows.Next() {
        var sc SafetyCategory
        if err := rows.Scan(&sc.CategoryID, &sc.Code, &sc.Description, &sc.ScoringSystem, &sc.PIScore); err == nil {
            safetyCategories = append(safetyCategories, sc)
        }
    }
    rows.Close()

    // Scorecard metrics
    rows, err = queryRows(ctx, `SELECT sc_category_id, sc_category, sc_description, driver_type_id FROM scorecard_metrics`)
    if err != nil {
        log.Printf("Bootstrap error (scorecard_metrics): %v", err)
        c.JSON(http.StatusInternalServerError, APIError{Message: "failed to fetch scorecard metrics data"})
        return
    }
    defer rows.Close()
    for rows.Next() {
        var (
            m              ScoreCardItem
            driverTypeNull sql.NullInt64
        )
        if err := rows.Scan(&m.ScCategoryID, &m.ScCategory, &m.ScDescription, &driverTypeNull); err == nil {
            if driverTypeNull.Valid {
                val := int(driverTypeNull.Int64)
                m.DriverTypeID = &val
            }
            scoreCard = append(scoreCard, m)
        }
    }
    rows.Close()

    // Safety events
    rows, err = queryRows(ctx, `SELECT safety_event_id, driver_id, event_date, category_id, notes, bonus_score, p_i_score, bonus_period FROM safety_events`)
    if err != nil {
        log.Printf("Bootstrap error (safety_events): %v", err)
        c.JSON(http.StatusInternalServerError, APIError{Message: "failed to fetch safety events data"})
        return
    }
    defer rows.Close()
    for rows.Next() {
        var (
            e       SafetyEvent
            dateVal time.Time
        )
        if err := rows.Scan(&e.SafetyEventID, &e.DriverID, &dateVal, &e.CategoryID, &e.Notes, &e.BonusScore, &e.PIScore, &e.BonusPeriod); err == nil {
            e.EventDate = formatLocalDate(dateVal)
            safetyEvents = append(safetyEvents, e)
        }
    }
    rows.Close()

    // Scorecard events
    rows, err = queryRows(ctx, `SELECT scorecard_event_id, driver_id, event_date, sc_category_id, sc_score, notes FROM scorecard_events`)
    if err != nil {
        log.Printf("Bootstrap error (scorecard_events): %v", err)
        c.JSON(http.StatusInternalServerError, APIError{Message: "failed to fetch scorecard events data"})
        return
    }
    defer rows.Close()
    for rows.Next() {
        var (
            e       ScoreCardEvent
            dateVal time.Time
        )
        if err := rows.Scan(&e.ScorecardEventID, &e.DriverID, &dateVal, &e.ScCategoryID, &e.ScScore, &e.Notes); err == nil {
            e.EventDate = formatLocalDate(dateVal)
            scoreCardEvents = append(scoreCardEvents, e)
        }
    }

    c.JSON(http.StatusOK, gin.H{
        "trucks":           trucks,
        "driverTypes":      driverTypes,
        "drivers":          drivers,
        "safetyCategories": safetyCategories,
        "scoreCard":        scoreCard,
        "safetyEvents":     safetyEvents,
        "scoreCardEvents":  scoreCardEvents,
    })
}

// --- Drivers ---

func getDrivers(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `SELECT driver_id, driver_code, first_name, last_name, start_date, truck_id, driver_type_id, profile_pic FROM drivers`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var drivers []Driver
    for rows.Next() {
        var (
            d                 Driver
            startDateNullable sql.NullTime
            truckIDNullable   sql.NullInt64
            typeIDNullable    sql.NullInt64
            picNullable       sql.NullString
        )
        if err := rows.Scan(&d.DriverID, &d.DriverCode, &d.FirstName, &d.LastName, &startDateNullable, &truckIDNullable, &typeIDNullable, &picNullable); err != nil {
            continue
        }
        if startDateNullable.Valid {
            d.StartDate = formatLocalDate(startDateNullable.Time)
        }
        if truckIDNullable.Valid {
            val := int(truckIDNullable.Int64)
            d.TruckID = &val
        }
        if typeIDNullable.Valid {
            val := int(typeIDNullable.Int64)
            d.DriverTypeID = &val
        }
        if picNullable.Valid {
            val := picNullable.String
            d.ProfilePic = &val
        }
        drivers = append(drivers, d)
    }
    c.JSON(http.StatusOK, drivers)
}

func createDriver(c *gin.Context) {
    var d Driver
    if err := c.ShouldBindJSON(&d); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    var startDate sql.NullString
    if strings.TrimSpace(d.StartDate) != "" {
        if t, err := parseLocalDate(d.StartDate); err == nil {
            startDate = sql.NullString{String: formatLocalDate(t), Valid: true}
        }
    }

    res, err := exec(ctx, `
        INSERT INTO drivers (driver_code, first_name, last_name, start_date, truck_id, driver_type_id, profile_pic)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        d.DriverCode, d.FirstName, d.LastName, startDate, d.TruckID, d.DriverTypeID, d.ProfilePic,
    )
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    id, _ := res.LastInsertId()
    d.DriverID = int(id)
    c.JSON(http.StatusOK, d)
}

func updateDriver(c *gin.Context) {
    id := atoi(c.Param("id"))
    var d Driver
    if err := c.ShouldBindJSON(&d); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    // 1. Fetch current truck_id to see if assignment changed
    var currentTruckID *int
    _ = db.QueryRowContext(ctx, "SELECT truck_id FROM drivers WHERE driver_id=?", id).Scan(&currentTruckID)

    // 2. Update the Driver
    _, err := exec(ctx, `
        UPDATE drivers 
        SET driver_code=?, first_name=?, last_name=?, start_date=?, truck_id=?, driver_type_id=?, profile_pic=?
        WHERE driver_id=?`,
        d.DriverCode, d.FirstName, d.LastName, d.StartDate, d.TruckID, d.DriverTypeID, d.ProfilePic, id,
    )
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: "Update failed"})
        return
    }

    if currentTruckID != nil && (d.TruckID == nil || *currentTruckID != *d.TruckID) {
        _, _ = exec(ctx, "UPDATE trucks SET status='available' WHERE truck_id=?", *currentTruckID)
    }

    if d.TruckID != nil {
        _, _ = exec(ctx, "UPDATE trucks SET status='assigned' WHERE truck_id=?", *d.TruckID)
    }

    d.DriverID = id
    c.JSON(http.StatusOK, d)
}

func deleteDriver(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `DELETE FROM drivers WHERE driver_id=?`, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

// Stats
func getDriverStats(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    row := db.QueryRowContext(ctx, `
        SELECT COUNT(*) AS eventCount,
               COALESCE(SUM(bonus_score),0) AS totalBonus,
               COALESCE(SUM(p_i_score),0) AS totalPI
        FROM safety_events WHERE driver_id=?`, id)

    var count int
    var totalBonus, totalPI int
    if err := row.Scan(&count, &totalBonus, &totalPI); err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }

    status := "Good"
    if totalBonus > 5 {
        status = "Warning"
    }
    c.JSON(http.StatusOK, gin.H{
        "eventCount":      count,
        "totalBonusScore": totalBonus,
        "totalPIScore":    totalPI,
        "status":          status,
    })
}

// --- Driver Types ---

func getDriverTypes(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `SELECT driver_type_id, driver_type FROM driver_type`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var types []DriverType
    for rows.Next() {
        var dt DriverType
        if err := rows.Scan(&dt.DriverTypeID, &dt.DriverType); err != nil {
            continue
        }
        types = append(types, dt)
    }
    c.JSON(http.StatusOK, types)
}

func createDriverType(c *gin.Context) {
    var dt DriverType
    if err := c.ShouldBindJSON(&dt); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    res, err := exec(ctx, `INSERT INTO driver_type (driver_type) VALUES (?)`, dt.DriverType)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    id, _ := res.LastInsertId()
    dt.DriverTypeID = int(id)
    c.JSON(http.StatusOK, dt)
}

func updateDriverType(c *gin.Context) {
    id := atoi(c.Param("id"))
    var dt DriverType
    if err := c.ShouldBindJSON(&dt); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `UPDATE driver_type SET driver_type=? WHERE driver_type_id=?`, dt.DriverType, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    dt.DriverTypeID = id
    c.JSON(http.StatusOK, dt)
}

func deleteDriverType(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `DELETE FROM driver_type WHERE driver_type_id=?`, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

// --- Trucks & Assignment ---

func getTrucks(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `SELECT truck_id, unit_number, year, status FROM trucks`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var trucks []Truck
    for rows.Next() {
        var t Truck
        if err := rows.Scan(&t.TruckID, &t.UnitNumber, &t.Year, &t.Status); err != nil {
            continue
        }
        trucks = append(trucks, t)
    }
    c.JSON(http.StatusOK, trucks)
}

func createTruck(c *gin.Context) {
    var t Truck
    if err := c.ShouldBindJSON(&t); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    res, err := exec(ctx, `INSERT INTO trucks (unit_number, year, status) VALUES (?, ?, ?)`, t.UnitNumber, t.Year, t.Status)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    id, _ := res.LastInsertId()
    t.TruckID = int(id)
    c.JSON(http.StatusOK, t)
}

func updateTruck(c *gin.Context) {
    id := atoi(c.Param("id"))
    var t Truck
    if err := c.ShouldBindJSON(&t); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `UPDATE trucks SET unit_number=?, year=?, status=? WHERE truck_id=?`, t.UnitNumber, t.Year, t.Status, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    t.TruckID = id
    c.JSON(http.StatusOK, t)
}

func deleteTruck(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    // Unassign drivers
    _, _ = exec(ctx, `UPDATE drivers SET truck_id=NULL WHERE truck_id=?`, id)
    _, err := exec(ctx, `DELETE FROM trucks WHERE truck_id=?`, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

func assignDriverToTruck(c *gin.Context) {
    truckID := atoi(c.Param("id"))
    var body struct {
        DriverId *int `json:"driverId"`
    }
    if err := c.ShouldBindJSON(&body); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 8*time.Second)
    defer cancel()

    // Clear any driver currently assigned to this truck
    _, _ = exec(ctx, `UPDATE drivers SET truck_id=NULL WHERE truck_id=?`, truckID)

    var updatedDriver *Driver
    if body.DriverId != nil {
        // Link new driver
        if _, err := exec(ctx, `UPDATE drivers SET truck_id=? WHERE driver_id=?`, truckID, *body.DriverId); err != nil {
            c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
            return
        }
        // Fetch driver
        row := db.QueryRowContext(ctx, `SELECT driver_id, driver_code, first_name, last_name, start_date, truck_id, driver_type_id, profile_pic FROM drivers WHERE driver_id=?`, *body.DriverId)
        var d Driver
        var (
            startDateNullable sql.NullTime
            truckIDNullable   sql.NullInt64
            typeIDNullable    sql.NullInt64
            picNullable       sql.NullString
        )
        if err := row.Scan(&d.DriverID, &d.DriverCode, &d.FirstName, &d.LastName, &startDateNullable, &truckIDNullable, &typeIDNullable, &picNullable); err == nil {
            if startDateNullable.Valid {
                d.StartDate = formatLocalDate(startDateNullable.Time)
            }
            if truckIDNullable.Valid {
                val := int(truckIDNullable.Int64)
                d.TruckID = &val
            }
            if typeIDNullable.Valid {
                val := int(typeIDNullable.Int64)
                d.DriverTypeID = &val
            }
            if picNullable.Valid {
                val := picNullable.String
                d.ProfilePic = &val
            }
            updatedDriver = &d
        } else {
            log.Printf("AssignDriverToTruck: failed to fetch driver details after update: %v", err)
        }
        // Set truck status
        _, _ = exec(ctx, `UPDATE trucks SET status='assigned' WHERE truck_id=?`, truckID)

        // Log history
        _, _ = exec(ctx, `INSERT INTO truck_history (truck_id, driver_id, type, notes, date) VALUES (?, ?, 'assignment', ?, ?)`,
            truckID, body.DriverId, fmt.Sprintf("Assigned driver ID %d", *body.DriverId), time.Now().In(localTZ))
    } else {
        // No driver: mark truck as available
        _, _ = exec(ctx, `UPDATE trucks SET status='available' WHERE truck_id=?`, truckID)
        _, _ = exec(ctx, `INSERT INTO truck_history (truck_id, driver_id, type, notes, date) VALUES (?, NULL, 'status_change', 'Unassigned driver', ?)`,
            truckID, time.Now().In(localTZ))
    }

    // Return updated truck
    row := db.QueryRowContext(ctx, `SELECT truck_id, unit_number, year, status FROM trucks WHERE truck_id=?`, truckID)
    var t Truck
    if err := row.Scan(&t.TruckID, &t.UnitNumber, &t.Year, &t.Status); err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.JSON(http.StatusOK, gin.H{"driver": updatedDriver, "truck": t})
}

// --- Truck history ---

func getTruckHistory(c *gin.Context) {
    truckID := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `
      SELECT truck_history_id, truck_id, driver_id, date, type, notes
      FROM truck_history WHERE truck_id=? ORDER BY date DESC`, truckID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var history []TruckHistoryEvent
    for rows.Next() {
        var h TruckHistoryEvent
        var (
            dateVal        time.Time
            driverNullable sql.NullInt64
            notesNullable  sql.NullString
        )
        if err := rows.Scan(&h.TruckHistoryID, &h.TruckID, &driverNullable, &dateVal, &h.Type, &notesNullable); err != nil {
            continue
        }
        if driverNullable.Valid {
            val := int(driverNullable.Int64)
            h.DriverID = &val
        }
        if notesNullable.Valid {
            val := notesNullable.String
            h.Notes = &val
        }
        h.Date = dateVal.In(localTZ).Format(time.RFC3339)
        history = append(history, h)
    }
    c.JSON(http.StatusOK, history)
}

// --- Safety categories ---

func getSafetyCategories(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `SELECT category_id, code, description, scoring_system, p_i_score FROM safety_categories`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var cats []SafetyCategory
    for rows.Next() {
        var sc SafetyCategory
        if err := rows.Scan(&sc.CategoryID, &sc.Code, &sc.Description, &sc.ScoringSystem, &sc.PIScore); err != nil {
            continue
        }
        cats = append(cats, sc)
    }
    c.JSON(http.StatusOK, cats)
}

func createSafetyCategory(c *gin.Context) {
    var sc SafetyCategory
    if err := c.ShouldBindJSON(&sc); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    res, err := exec(ctx, `
      INSERT INTO safety_categories (code, description, scoring_system, p_i_score)
      VALUES (?, ?, ?, ?)`, sc.Code, sc.Description, sc.ScoringSystem, sc.PIScore)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    id, _ := res.LastInsertId()
    sc.CategoryID = int(id)
    c.JSON(http.StatusOK, sc)
}

func updateSafetyCategory(c *gin.Context) {
    id := atoi(c.Param("id"))
    var sc SafetyCategory
    if err := c.ShouldBindJSON(&sc); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `
      UPDATE safety_categories SET code=?, description=?, scoring_system=?, p_i_score=? WHERE category_id=?`,
        sc.Code, sc.Description, sc.ScoringSystem, sc.PIScore, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    sc.CategoryID = id
    c.JSON(http.StatusOK, sc)
}

func deleteSafetyCategory(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `DELETE FROM safety_categories WHERE category_id=?`, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

// --- Scorecard metrics (items) ---

func getScorecardMetrics(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `SELECT sc_category_id, sc_category, sc_description, driver_type_id FROM scorecard_metrics`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var items []ScoreCardItem
    for rows.Next() {
        var (
            m              ScoreCardItem
            driverTypeNull sql.NullInt64
        )
        if err := rows.Scan(&m.ScCategoryID, &m.ScCategory, &m.ScDescription, &driverTypeNull); err != nil {
            continue
        }
        if driverTypeNull.Valid {
            val := int(driverTypeNull.Int64)
            m.DriverTypeID = &val
        }
        items = append(items, m)
    }
    c.JSON(http.StatusOK, items)
}

func createScorecardMetric(c *gin.Context) {
    var m ScoreCardItem
    if err := c.ShouldBindJSON(&m); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    res, err := exec(ctx, `
      INSERT INTO scorecard_metrics (sc_category, sc_description, driver_type_id) VALUES (?, ?, ?)`,
        m.ScCategory, m.ScDescription, m.DriverTypeID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    id, _ := res.LastInsertId()
    m.ScCategoryID = int(id)
    c.JSON(http.StatusOK, m)
}

func updateScorecardMetric(c *gin.Context) {
    id := atoi(c.Param("id"))
    var m ScoreCardItem
    if err := c.ShouldBindJSON(&m); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `
      UPDATE scorecard_metrics SET sc_category=?, sc_description=?, driver_type_id=? WHERE sc_category_id=?`,
        m.ScCategory, m.ScDescription, m.DriverTypeID, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    m.ScCategoryID = id
    c.JSON(http.StatusOK, m)
}

func deleteScorecardMetric(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `DELETE FROM scorecard_metrics WHERE sc_category_id=?`, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

// --- Safety events ---

func getSafetyEvents(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `SELECT safety_event_id, driver_id, event_date, category_id, notes, bonus_score, p_i_score, bonus_period FROM safety_events`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var events []SafetyEvent
    for rows.Next() {
        var (
            e       SafetyEvent
            dateVal time.Time
        )
        if err := rows.Scan(&e.SafetyEventID, &e.DriverID, &dateVal, &e.CategoryID, &e.Notes, &e.BonusScore, &e.PIScore, &e.BonusPeriod); err != nil {
            continue
        }
        e.EventDate = formatLocalDate(dateVal)
        events = append(events, e)
    }
    c.JSON(http.StatusOK, events)
}

func createSafetyEvent(c *gin.Context) {
    var e SafetyEvent
    if err := c.ShouldBindJSON(&e); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    t, err := parseLocalDate(e.EventDate)
    if err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: "invalid event_date"})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    res, err := exec(ctx, `
      INSERT INTO safety_events (driver_id, event_date, category_id, notes, bonus_score, p_i_score, bonus_period)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
        e.DriverID, formatLocalDate(t), e.CategoryID, e.Notes, e.BonusScore, e.PIScore, e.BonusPeriod)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    id, _ := res.LastInsertId()
    e.SafetyEventID = int(id)
    c.JSON(http.StatusOK, e)
}

func updateSafetyEvent(c *gin.Context) {
    id := atoi(c.Param("id"))
    var e SafetyEvent
    if err := c.ShouldBindJSON(&e); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }

    t, err := parseLocalDate(e.EventDate)
    if err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: "invalid event_date"})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err = exec(ctx, `
      UPDATE safety_events SET driver_id=?, event_date=?, category_id=?, notes=?, bonus_score=?, p_i_score=?, bonus_period=? WHERE safety_event_id=?`,
        e.DriverID, formatLocalDate(t), e.CategoryID, e.Notes, e.BonusScore, e.PIScore, e.BonusPeriod, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    e.SafetyEventID = id
    c.JSON(http.StatusOK, e)
}

func deleteSafetyEvent(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `DELETE FROM safety_events WHERE safety_event_id=?`, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

// --- Scorecard events ---

func getScoreCardEvents(c *gin.Context) {
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    rows, err := queryRows(ctx, `SELECT scorecard_event_id, driver_id, event_date, sc_category_id, sc_score, notes FROM scorecard_events`)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var events []ScoreCardEvent
    for rows.Next() {
        var (
            e       ScoreCardEvent
            dateVal time.Time
        )
        if err := rows.Scan(&e.ScorecardEventID, &e.DriverID, &dateVal, &e.ScCategoryID, &e.ScScore, &e.Notes); err != nil {
            continue
        }
        e.EventDate = formatLocalDate(dateVal)
        events = append(events, e)
    }
    c.JSON(http.StatusOK, events)
}

func createScoreCardEvent(c *gin.Context) {
    var e ScoreCardEvent
    if err := c.ShouldBindJSON(&e); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    t, err := parseLocalDate(e.EventDate)
    if err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: "invalid event_date"})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    res, err := exec(ctx, `
      INSERT INTO scorecard_events (driver_id, event_date, sc_category_id, sc_score, notes)
      VALUES (?, ?, ?, ?, ?)`,
        e.DriverID, formatLocalDate(t), e.ScCategoryID, e.ScScore, e.Notes)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    id, _ := res.LastInsertId()
    e.ScorecardEventID = int(id)
    c.JSON(http.StatusOK, e)
}

func updateScoreCardEvent(c *gin.Context) {
    id := atoi(c.Param("id"))
    var e ScoreCardEvent
    if err := c.ShouldBindJSON(&e); err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: err.Error()})
        return
    }
    t, err := parseLocalDate(e.EventDate)
    if err != nil {
        c.JSON(http.StatusBadRequest, APIError{Message: "invalid event_date"})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err = exec(ctx, `
      UPDATE scorecard_events SET driver_id=?, event_date=?, sc_category_id=?, sc_score=?, notes=? WHERE scorecard_event_id=?`,
        e.DriverID, formatLocalDate(t), e.ScCategoryID, e.ScScore, e.Notes, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    e.ScorecardEventID = id
    c.JSON(http.StatusOK, e)
}

func deleteScoreCardEvent(c *gin.Context) {
    id := c.Param("id")
    ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
    defer cancel()

    _, err := exec(ctx, `DELETE FROM scorecard_events WHERE scorecard_event_id=?`, id)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

// Bulk delete using query params (DELETE /scorecard-events?driverId=&datePrefix=&category=)
func deleteScoreCardEventsByFilter(c *gin.Context) {
    driverID := c.Query("driverId")
    datePrefix := c.Query("datePrefix") // YYYY or YYYY-MM or YYYY-MM-DD
    category := c.Query("category")     // 'SAFETY' | 'MAINTENANCE' | 'DISPATCH'

    if driverID == "" || datePrefix == "" || category == "" {
        c.JSON(http.StatusBadRequest, APIError{Message: "driverId, datePrefix and category are required"})
        return
    }

    ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
    defer cancel()

    // Resolve category -> list of ids
    rows, err := queryRows(ctx, `SELECT sc_category_id FROM scorecard_metrics WHERE sc_category=?`, category)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    defer rows.Close()

    var ids []int
    for rows.Next() {
        var id int
        _ = rows.Scan(&id)
        ids = append(ids, id)
    }
    if len(ids) == 0 {
        c.Status(http.StatusNoContent)
        return
    }

    // Build IN clause
    in := strings.Repeat("?,", len(ids))
    in = strings.TrimRight(in, ",")

    args := []any{driverID, datePrefix + "%"}
    for _, id := range ids {
        args = append(args, id)
    }

    _, err = exec(ctx, fmt.Sprintf(`DELETE FROM scorecard_events WHERE driver_id=? AND event_date LIKE ? AND sc_category_id IN (%s)`, in), args...)
    if err != nil {
        c.JSON(http.StatusInternalServerError, APIError{Message: err.Error()})
        return
    }
    c.Status(http.StatusNoContent)
}

// --- OpenAPI + Swagger ---

func serveOpenAPI(c *gin.Context) {
    // Minimal spec to visualize routes in Swagger UI; extend as needed.
    openapi := `{
  "openapi": "3.0.3",
  "info": { "title": "DriverSafetyBonus API", "version": "1.0.0" },
  "servers": [{ "url": "/api" }],
  "paths": {
    "/healthz": { "get": { "summary": "Healthcheck" } },
    "/bootstrap": { "get": { "summary": "Initial data bootstrap" } },
    "/drivers": { "get": { "summary": "List drivers" }, "post": { "summary": "Create driver" } },
    "/drivers/{id}": { "put": { "summary": "Update driver" }, "delete": { "summary": "Delete driver" } },
    "/drivers/{id}/stats": { "get": { "summary": "Driver stats" } },
    "/driver-types": { "get": { "summary": "List driver types" }, "post": { "summary": "Create driver type" } },
    "/driver-types/{id}": { "put": { "summary": "Update driver type" }, "delete": { "summary": "Delete driver type" } },
    "/trucks": { "get": { "summary": "List trucks" }, "post": { "summary": "Create truck" } },
    "/trucks/{id}": { "put": { "summary": "Update truck" }, "delete": { "summary": "Delete truck" } },
    "/trucks/{id}/history": { "get": { "summary": "Truck history" } },
    "/trucks/{id}/assign-driver": { "post": { "summary": "Assign driver to truck" } },
    "/safety-categories": { "get": { "summary": "List safety categories" }, "post": { "summary": "Create safety category" } },
    "/safety-categories/{id}": { "put": { "summary": "Update safety category" }, "delete": { "summary": "Delete safety category" } },
    "/scorecard-metrics": { "get": { "summary": "List scorecard metrics" }, "post": { "summary": "Create scorecard metric" } },
    "/scorecard-metrics/{id}": { "put": { "summary": "Update scorecard metric" }, "delete": { "summary": "Delete scorecard metric" } },
    "/safety-events": { "get": { "summary": "List safety events" }, "post": { "summary": "Create safety event" } },
    "/safety-events/{id}": { "put": { "summary": "Update safety event" }, "delete": { "summary": "Delete safety event" } },
    "/scorecard-events": { "get": { "summary": "List scorecard events" }, "post": { "summary": "Create scorecard event" }, "delete": { "summary": "Bulk delete scorecard events by filter" } },
    "/scorecard-events/{id}": { "put": { "summary": "Update scorecard event" }, "delete": { "summary": "Delete scorecard event" } }
  }
}`
    c.Data(http.StatusOK, "application/json; charset=utf-8", []byte(openapi))
}

func serveSwaggerUI(c *gin.Context) {
    html := `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>DriverSafetyBonus API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css"/>
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>
window.onload = () => {
  SwaggerUIBundle({
    url: '/openapi.json',
    dom_id: '#swagger-ui'
  });
};
</script>
</body>
</html>`
    c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(html))
}