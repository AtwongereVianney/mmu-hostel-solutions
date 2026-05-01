<?php
require_once 'new-hostel/config/db.php';

$seed_hostels = [
  [
    'id' => 1,
    'name' => 'Rwenzori Hall',
    'gender' => 'Mixed',
    'distance' => '0.3 km from Main Gate',
    'description' => 'Modern hall with Rwenzori mountain views, 24/7 security, Wi-Fi and clean water supply.',
    'manager_phone' => '0765958809',
    'rating' => 4.5,
    'address' => 'Along Kibundaire Road, Fort Portal City',
    'location_lat' => '0.6591',
    'location_lng' => '30.2752',
    'amenities_json' => json_encode(['Wi-Fi', 'Security', 'Water', 'Electricity', 'Laundry']),
    'rooms' => [
      ['id' => 101, 'number' => 'R101', 'type' => 'Single', 'price' => 450000, 'status' => 'vacant'],
      ['id' => 102, 'number' => 'R102', 'type' => 'Double', 'price' => 300000, 'status' => 'vacant'],
      ['id' => 103, 'number' => 'R103', 'type' => 'Single', 'price' => 450000, 'status' => 'pending'],
      ['id' => 104, 'number' => 'R201', 'type' => 'Triple', 'price' => 220000, 'status' => 'vacant'],
      ['id' => 105, 'number' => 'R202', 'type' => 'Double', 'price' => 300000, 'status' => 'occupied'],
    ],
  ],
  [
    'id' => 2,
    'name' => 'Saaka Hostel',
    'gender' => 'Female',
    'distance' => '0.5 km from Main Gate',
    'description' => 'Quiet female-only hostel near the library, excellent study environment.',
    'manager_phone' => '0756188401',
    'rating' => 4.2,
    'address' => 'Saaka Campus Road, Fort Portal City',
    'location_lat' => '0.6620',
    'location_lng' => '30.2650',
    'amenities_json' => json_encode(['Wi-Fi', 'Security', 'Water', 'Electricity', 'Study Room']),
    'rooms' => [
      ['id' => 201, 'number' => 'S101', 'type' => 'Single', 'price' => 500000, 'status' => 'vacant'],
      ['id' => 202, 'number' => 'S102', 'type' => 'Double', 'price' => 320000, 'status' => 'vacant'],
      ['id' => 203, 'number' => 'S103', 'type' => 'Single', 'price' => 500000, 'status' => 'occupied'],
    ],
  ],
  [
    'id' => 3,
    'name' => 'Tooro Block',
    'gender' => 'Male',
    'distance' => '0.8 km from Main Gate',
    'description' => 'Affordable male hostel with sports facilities and a friendly atmosphere.',
    'manager_phone' => '0765958809',
    'rating' => 3.8,
    'address' => 'Fort Portal–Kasese Road, Fort Portal City',
    'location_lat' => '0.6560',
    'location_lng' => '30.2800',
    'amenities_json' => json_encode(['Security', 'Water', 'Electricity', 'Parking', 'Kitchen']),
    'rooms' => [
      ['id' => 301, 'number' => 'T101', 'type' => 'Triple', 'price' => 200000, 'status' => 'vacant'],
      ['id' => 302, 'number' => 'T102', 'type' => 'Double', 'price' => 270000, 'status' => 'vacant'],
      ['id' => 303, 'number' => 'T103', 'type' => 'Triple', 'price' => 200000, 'status' => 'pending'],
    ],
  ],
];

// Re-run extended column creation just in case
mysqli_query($conn, "ALTER TABLE hostels ADD COLUMN IF NOT EXISTS gender VARCHAR(20) NULL");
mysqli_query($conn, "ALTER TABLE hostels ADD COLUMN IF NOT EXISTS distance VARCHAR(120) NULL");
mysqli_query($conn, "ALTER TABLE hostels ADD COLUMN IF NOT EXISTS manager_phone VARCHAR(25) NULL");
mysqli_query($conn, "ALTER TABLE hostels ADD COLUMN IF NOT EXISTS rating DECIMAL(3,1) NULL");
mysqli_query($conn, "ALTER TABLE hostels ADD COLUMN IF NOT EXISTS amenities_json TEXT NULL");
mysqli_query($conn, "ALTER TABLE hostels ADD COLUMN IF NOT EXISTS location_lat VARCHAR(30) NULL");
mysqli_query($conn, "ALTER TABLE hostels ADD COLUMN IF NOT EXISTS location_lng VARCHAR(30) NULL");

foreach ($seed_hostels as $h) {
    $stmt = mysqli_prepare($conn, "INSERT IGNORE INTO hostels (id, business_id, branch_id, owner_id, name, address, description, gender, distance, manager_phone, rating, amenities_json, location_lat, location_lng) VALUES (?, 1, 1, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    mysqli_stmt_bind_param($stmt, 'issssssdsss', $h['id'], $h['name'], $h['address'], $h['description'], $h['gender'], $h['distance'], $h['manager_phone'], $h['rating'], $h['amenities_json'], $h['location_lat'], $h['location_lng']);
    mysqli_stmt_execute($stmt);
    mysqli_stmt_close($stmt);

    foreach ($h['rooms'] as $r) {
        $rStmt = mysqli_prepare($conn, "INSERT IGNORE INTO rooms (id, business_id, branch_id, hostel_id, room_number, type, price, status) VALUES (?, 1, 1, ?, ?, ?, ?, ?)");
        mysqli_stmt_bind_param($rStmt, 'iiisds', $r['id'], $h['id'], $r['number'], $r['type'], $r['price'], $r['status']);
        mysqli_stmt_execute($rStmt);
        mysqli_stmt_close($rStmt);
    }
}

echo "Seeded database with hostels and rooms successfully!\n";
