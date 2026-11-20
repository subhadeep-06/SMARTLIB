package com.smartlib.inventory;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "book_copies")
@CompoundIndex(name = "idx_copy_book_branch_status", def = "{'bookId': 1, 'branchId': 1, 'status': 1}")
public class BookCopyDocument {
    @Id
    private String id;
    @Indexed(unique = true)
    private String copyCode;
    @Indexed
    private String bookId;
    @Indexed(unique = true)
    private String barcode;
    @Indexed(unique = true)
    private String qrToken;
    @Indexed
    private String branchId;
    private ShelfLocation location;
    private CopyStatus status;
    private String condition;
    private Instant acquisitionDate;
    private Instant lastVerifiedAt;
    @Version
    private Long version;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant updatedAt;

    public record ShelfLocation(int floor, String section, String rack, String shelf) {}

    public enum CopyStatus {
        AVAILABLE, ISSUED, RESERVED_HOLD, IN_TRANSIT, DAMAGED, LOST, ARCHIVED
    }

    public String getId() { return id; }
    public String getCopyCode() { return copyCode; }
    public String getBookId() { return bookId; }
    public String getBranchId() { return branchId; }
    public CopyStatus getStatus() { return status; }
    public void setStatus(CopyStatus status) { this.status = status; }
    public ShelfLocation getLocation() { return location; }
    public void setLocation(ShelfLocation location) { this.location = location; }
}
