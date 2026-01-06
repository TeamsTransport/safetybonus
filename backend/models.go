// models.go
package main

type Truck struct {
    TruckID    int    `json:"truck_id"`
    UnitNumber string `json:"unit_number"`
    Year       int    `json:"year"`
    Status     string `json:"status"` // "available" | "maintenance" | "assigned"
}

type Driver struct {
    DriverID     int     `json:"driver_id"`
    DriverCode   string  `json:"driver_code"`
    FirstName    string  `json:"first_name"`
    LastName     string  `json:"last_name"`
    StartDate    string  `json:"start_date"` // YYYY-MM-DD (Winnipeg local date)
    TruckID      *int    `json:"truck_id"`
    DriverTypeID *int    `json:"driver_type_id"`
    ProfilePic   *string `json:"profile_pic"`
}

type DriverType struct {
    DriverTypeID int    `json:"driver_type_id"`
    DriverType   string `json:"driver_type"`
}

type SafetyCategory struct {
    CategoryID    int    `json:"category_id"`
    Code          string `json:"code"`
    Description   string `json:"description"`
    ScoringSystem int    `json:"scoring_system"`
    PIScore       int    `json:"p_i_score"`
}

type ScoreCardItem struct {
    ScCategoryID  int    `json:"sc_category_id"`
    ScCategory    string `json:"sc_category"`    // 'SAFETY' | 'MAINTENANCE' | 'DISPATCH'
    ScDescription string `json:"sc_description"`
    DriverTypeID  *int   `json:"driver_type_id"` // null for global
}

type SafetyEvent struct {
    SafetyEventID int    `json:"safety_event_id"`
    DriverID      int    `json:"driver_id"`
    EventDate     string `json:"event_date"` // YYYY-MM-DD (Winnipeg local date)
    CategoryID    int    `json:"category_id"`
    Notes         string `json:"notes"`
    BonusScore    int    `json:"bonus_score"`
    PIScore       int    `json:"p_i_score"`
    BonusPeriod   bool   `json:"bonus_period"`
}

type ScoreCardEvent struct {
    ScorecardEventID int    `json:"scorecard_event_id"`
    DriverID         int    `json:"driver_id"`
    EventDate        string `json:"event_date"`     // YYYY-MM-DD (Winnipeg local date)
    ScCategoryID     int    `json:"sc_category_id"`
    ScScore          int    `json:"sc_score"`
    Notes            string `json:"notes"`
}

type TruckHistoryEvent struct {
    TruckHistoryID int     `json:"truck_history_id"`
    TruckID        int     `json:"truck_id"`
    DriverID       *int    `json:"driver_id"`
    Date           string  `json:"date"` // ISO8601 Winnipeg local datetime
    Type           string  `json:"type"` // 'assignment' | 'maintenance' | 'status_change'
    Notes          *string `json:"notes"`
}

type APIError struct {
    Message string `json:"message"`
}
