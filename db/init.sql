CREATE DATABASE IF NOT EXISTS driver_safety;
USE driver_safety;

SET FOREIGN_KEY_CHECKS = 0;

-- TRUCKS
CREATE TABLE IF NOT EXISTS trucks (
  truck_id     INT AUTO_INCREMENT PRIMARY KEY,
  unit_number  VARCHAR(50) NOT NULL UNIQUE,
  year         INT NOT NULL,
  status       ENUM('available','maintenance','assigned') NOT NULL DEFAULT 'available',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- DRIVER TYPES
CREATE TABLE IF NOT EXISTS driver_type (
  driver_type_id INT AUTO_INCREMENT PRIMARY KEY,
  driver_type    VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
  driver_id      INT AUTO_INCREMENT PRIMARY KEY,
  driver_code    VARCHAR(50) NOT NULL UNIQUE,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  start_date     DATE,
  truck_id       INT NULL,
  driver_type_id INT NULL,
  profile_pic    LONGTEXT,
  CONSTRAINT fk_driver_truck
    FOREIGN KEY (truck_id) REFERENCES trucks(truck_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_driver_type
    FOREIGN KEY (driver_type_id) REFERENCES driver_type(driver_type_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_driver_name (last_name, first_name)
) ENGINE=InnoDB;

-- TRUCK HISTORY
CREATE TABLE IF NOT EXISTS truck_history (
  truck_history_id INT AUTO_INCREMENT PRIMARY KEY,
  truck_id         INT NOT NULL,
  driver_id        INT NULL,
  date             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type             ENUM('assignment','maintenance','status_change') NOT NULL,
  notes            TEXT,
  CONSTRAINT fk_th_truck
    FOREIGN KEY (truck_id) REFERENCES trucks(truck_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_th_driver
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_truck_date (truck_id, date)
) ENGINE=InnoDB;

-- SAFETY CATEGORIES
CREATE TABLE IF NOT EXISTS safety_categories (
  category_id    INT AUTO_INCREMENT PRIMARY KEY,
  code           VARCHAR(50) NOT NULL UNIQUE,
  description    VARCHAR(255) NOT NULL,
  scoring_system INT NOT NULL,
  p_i_score      INT NOT NULL
) ENGINE=InnoDB;

-- SCORECARD METRICS (ITEMS)
CREATE TABLE IF NOT EXISTS scorecard_metrics (
  sc_category_id  INT AUTO_INCREMENT PRIMARY KEY,
  sc_category     ENUM('SAFETY','MAINTENANCE','DISPATCH') NOT NULL,
  sc_description  TEXT NOT NULL,
  driver_type_id  INT NULL,
  CONSTRAINT fk_sc_driver_type
    FOREIGN KEY (driver_type_id) REFERENCES driver_type(driver_type_id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_sc_category (sc_category),
  INDEX idx_sc_driver_type (driver_type_id)
) ENGINE=InnoDB;

-- SAFETY EVENTS
CREATE TABLE IF NOT EXISTS safety_events (
  safety_event_id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id       INT NOT NULL,
  event_date      DATE NOT NULL,
  category_id     INT NOT NULL,
  notes           TEXT,
  bonus_score     INT NOT NULL DEFAULT 0,
  p_i_score       INT NOT NULL DEFAULT 0,
  bonus_period    BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_se_driver
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_se_category
    FOREIGN KEY (category_id) REFERENCES safety_categories(category_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_se_driver_date (driver_id, event_date),
  INDEX idx_se_category (category_id),
  INDEX idx_se_bonus_period (bonus_period)
) ENGINE=InnoDB;

-- SCORECARD EVENTS
CREATE TABLE IF NOT EXISTS scorecard_events (
  scorecard_event_id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id          INT NOT NULL,
  event_date         DATE NOT NULL DEFAULT (CURDATE()),
  sc_category_id     INT NOT NULL,
  sc_score           INT NOT NULL,
  notes              VARCHAR(500),
  CONSTRAINT fk_sce_driver
    FOREIGN KEY (driver_id) REFERENCES drivers(driver_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_sce_metric
    FOREIGN KEY (sc_category_id) REFERENCES scorecard_metrics(sc_category_id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_sce_driver_date (driver_id, event_date),
  INDEX idx_sce_category (sc_category_id)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed data (idempotent)
INSERT INTO driver_type (driver_type) VALUES
  ('Owner Operator'),
  ('Company Driver')
ON DUPLICATE KEY UPDATE driver_type=VALUES(driver_type);

-- Safety categories (sample set)
INSERT INTO safety_categories (code, description, scoring_system, p_i_score) VALUES
('B00001','Minor Preventable Accident (<$5000)',5,5),
('P00001','Major Preventable Accident (>$5000)',10,10),
('B00002','Canada 2-Hour Violation',2,0),
('B00003','Canada 10-Hour Violation',2,0),
('B00004','Canada 13-Hour Violation',5,0),
('B00005','Canada 14-Hour Violation',5,0),
('B00006','Canada 16-Hour Violation',5,0),
('B00007','Canada 70-Hour Violation',2,0),
('B00008','Canada 24-Hour Violation',2,0),
('B00009','US 11-Hour Violation',5,0),
('B00010','US 14-Hour Violation',5,0),
('B00011','US Rest Break Violation',2,0),
('B00012','US 70-Hour Violation',2,0),
('P00002','Abuse of Personal Conveyance',8,8),
('B00013','Speeding 0-10 MPH',3,0),
('B00014','Speeding 11-14 MPH',5,0),
('B00015','Speeding 15+ MPH',10,0),
('P00003','Passed Level 1 Inspection',-5,-5),
('P00004','Passed Level 2 Inspection',-2,-2),
('P00005','Passed Level 3 Inspection',-2,-2),
('P00006','Failed Level 1 Inspection',10,10),
('P00007','Failed Level 2 Inspection',5,5),
('P00008','Failed Level 3 Inspection',5,5),
('P00009','Distracted Driving',10,10),
('P00010','Inattentive Driving',10,10),
('P00011','Photo Radar Ticket',5,5),
('P00012','Ticket(s)',10,10),
('P00013','Failed Spot Check',3,3),
('P00014','Passed Spot Check',-1,-1),
('P00015','Equipment Damage - Minor ($0-$3k)',2,2),
('P00016','Equipment Damage - Major ($3k+)',5,5)
ON DUPLICATE KEY UPDATE code=VALUES(code);

-- Scorecard metrics (sample)
INSERT INTO scorecard_metrics (sc_category, sc_description, driver_type_id) VALUES
('SAFETY','Speeding 6-10 MPH Over',NULL),
('SAFETY','Speeding 11-14 MPH Over',NULL),
('SAFETY','Speeding 15+ MPH Over',NULL),
('SAFETY','Fail to Maintain Lane',NULL),
('SAFETY','Fail to Wear Seatbelt',NULL),
('SAFETY','Motorist Complaint',NULL),
('SAFETY','Distracted Driving',NULL),
('SAFETY','Ran Red Light',NULL),
('SAFETY','Ran Stop Sign',NULL),
('SAFETY','Cargo-Load Securement',NULL),
('SAFETY','Minor Non-Preventable Accident',NULL),
('SAFETY','Minor Preventable Accident',NULL),
('SAFETY','Major Non-Preventable Accident',NULL),
('SAFETY','Major Preventable Accident',NULL),
('MAINTENANCE','DVIRs Completed for Truck',NULL),
('MAINTENANCE','DVIRs Completed for Trailers',NULL),
('MAINTENANCE','Truck Well Maintained',NULL),
('MAINTENANCE','Truck Serviced at Regular Intervals',2),
('MAINTENANCE','Truck Damage Repaired ASAP',2),
('MAINTENANCE','Maintenance Envelopes on the 15th',2),
('DISPATCH','Macros Completed - Accurate',NULL),
('DISPATCH','Scale Trailer - Weight Verified',NULL),
('DISPATCH','Freight Verified - Communicated',NULL),
('DISPATCH','Ensured Correct Footage',NULL),
('DISPATCH','On Time for Appointments',NULL),
('DISPATCH','Notified Dispatch of Changes',NULL),
('DISPATCH','Time Off Booked Ahead via Macro',NULL),
('DISPATCH','Took Trip as Planned',NULL),
('DISPATCH','Ready to Go as Per PTA',NULL),
('DISPATCH','Load Refusal',NULL),
('DISPATCH','Read All Trip Instructions',NULL);
