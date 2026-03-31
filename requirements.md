# Product Requirements Document (PRD): Book Lending & Recommendation App

## 1. Overview
An application designed for young readers (targeting 3rd to 8th grade) where they can discover, recommend, and borrow books from peers. Users can review books, track community rankings, and coordinate borrowing physical books securely.

## 2. Authentication Flow
* **Landing Page**: Users see two primary options: "Login" and "Sign up".
* **Sign Up**:
  * **Fields Required**: Real Name (functioning as the Username) and Password.
  * Note: The password can be freely chosen by the user (even "fake" or simplified).
* **Log In**:
  * **Fields Required**: Username/Name and Password (must match the credentials created during the initial sign-up process).

## 3. Main Navigation
Upon successful authentication, the user is presented with two core navigation buttons:
1. **Recommendation and Lend**
2. **Discover and Borrow**

## 4. Feature Specifications

### 4.1. Recommendation and Lend
* **Top Recommendations**: The first view presents the top three book recommendations to the user, displaying the book names.
* **Content Filtering**: All books in the database are strictly restricted to reading levels between 3rd grade and 8th grade.
* **Lending Area**: 
  * Users can navigate here to check if a specific recommended book is currently available to borrow from the user who recommended it.
* **Review System**:
  * After finishing a book, readers can write a review.
  * The rating system relies on a simple "Thumbs Up" (good) or "Thumbs Down" (bad) mechanism, alongside a written review.
* **Borrowing Coordination Workflow**:
  * A user who wants to borrow a book initiates a request.
  * The lender receives a **private notification** from the interested borrower.
  * The two users can subsequently coordinate a physical location to hand over the book.

### 4.2. Discover and Borrow
* **Book Rankings**: Displays a categorized ranking of books based on community reception.
  * Sorts from "Most Thumbs Up" down to "Most Thumbs Down".
  * Sorts from "Good Reviews" down to "Bad Reviews".
* **Aggregate Reviews**: The system provides an aggregated consensus based on searched reviews to indicate whether a book is generally considered good or not.
* **Interactive Book Details**:
  * Readers can browse, search, and dynamically click on any chosen book.
  * The detailed view shows the specific reviews for the book.
  * The detailed view also clearly indicates if the book is currently available for borrowing from another user.
